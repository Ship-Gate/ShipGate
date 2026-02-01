// ============================================================================
// SendEmail Behavior
// ============================================================================
// Send email notifications with template support
// ============================================================================

domain Notifications {
  
  behavior SendEmail {
    description: "Send an email notification"
    
    actors {
      sender: {
        with_permission: "notifications:send:email"
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      // Recipient(s)
      to: Email
      cc: List<Email>?
      bcc: List<Email>?
      reply_to: Email?
      
      // Template
      template_id: TemplateId
      variables: Map<String, String>
      
      // Direct content (alternative to template)
      subject: String?
      body: String?
      html_body: String?
      
      // Attachments
      attachments: List<Attachment>?
      
      // Sender info
      from_address: Email?
      from_name: String?
      
      // Options
      priority: NotificationPriority?
      scheduled_at: Timestamp?
      
      // Tracking
      campaign_id: String?
      tags: Map<String, String>?
      
      // Idempotency
      idempotency_key: String?
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: Notification
      errors {
        TEMPLATE_NOT_FOUND {
          when: "Template does not exist"
        }
        MISSING_VARIABLE {
          when: "Required template variable not provided"
          returns: { missing: List<String> }
        }
        INVALID_VARIABLE {
          when: "Variable value fails validation"
          returns: { variable: String, error: String }
        }
        INVALID_RECIPIENT {
          when: "Email address is invalid or undeliverable"
        }
        INVALID_ATTACHMENT {
          when: "Attachment is invalid or too large"
        }
        ATTACHMENTS_TOO_LARGE {
          when: "Total attachment size exceeds 25MB"
        }
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
          retry_after: 1.minute
        }
        SENDER_BLOCKED {
          when: "Sender address is blocked"
        }
        RECIPIENT_UNSUBSCRIBED {
          when: "Recipient has unsubscribed"
        }
        PROVIDER_ERROR {
          when: "Email provider returned an error"
          retriable: true
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      // Template must exist and be for email
      Template.exists(input.template_id)
      Template.lookup(input.template_id).channel == EMAIL
      Template.lookup(input.template_id).active == true
      
      // Recipient not unsubscribed
      not UnsubscribeList.contains(input.to)
      
      // Attachments size check
      input.attachments == null or 
        sum(input.attachments, a => a.size) <= 26214400  // 25MB
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        // Notification created
        Notification.exists(result.id)
        result.channel == EMAIL
        result.recipient == input.to
        result.template_id == input.template_id
        result.status in [PENDING, QUEUED, SENT]
        
        // CC/BCC captured
        input.cc != null implies result.cc == input.cc
        input.bcc != null implies result.bcc == input.bcc
        
        // Attachments captured
        input.attachments != null implies result.attachments == input.attachments
        
        // Scheduling respected
        input.scheduled_at != null implies result.scheduled_at == input.scheduled_at
        
        // Priority respected
        input.priority != null implies result.priority == input.priority
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Idempotency
      same(input.idempotency_key) implies same(result)
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      // API response time
      response within 500.ms (p99)
      response within 100.ms (p50)
      
      // Delivery SLA
      eventually within 5.minutes: result.status in [SENT, FAILED]
      eventually within 1.hour: result.status in [DELIVERED, BOUNCED, FAILED]
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("notifications:send:email")
      
      // Per-sender limits
      rate_limit: 100.per_minute per sender
      
      // Per-recipient limits (prevent spam)
      rate_limit: 10.per_minute per input.to
      
      // Daily limits
      rate_limit: 10000.per_day per sender
    }
    
    // ========================================================================
    // COMPLIANCE
    // ========================================================================
    
    compliance {
      can_spam {
        unsubscribe_link_required: true
        physical_address_required: true
        accurate_from_header: true
        no_deceptive_subject: true
      }
      
      gdpr {
        recipient_consent_required: true
        consent_record_retention: 7.years
        right_to_erasure: supported
        data_portability: supported
      }
      
      ccpa {
        opt_out_mechanism: required
        disclosure_required: true
      }
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter emails_sent { labels: [template_id, status] }
        counter emails_delivered { labels: [template_id] }
        counter emails_bounced { labels: [template_id, bounce_type] }
        histogram email_delivery_time { labels: [template_id, priority] }
      }
      
      traces {
        span: "send_email"
        attributes: [template_id, recipient_domain, priority]
      }
      
      logs {
        on_success: info { 
          include: [notification_id, template_id, recipient_domain]
          exclude: [recipient, variables]  // PII
        }
        on_error: warn {
          include: [notification_id, template_id, error_code]
        }
      }
    }
  }
  
  // ==========================================================================
  // SEND EMAIL DIRECT (no template)
  // ==========================================================================
  
  behavior SendEmailDirect {
    description: "Send email without template"
    
    input {
      to: Email
      cc: List<Email>?
      bcc: List<Email>?
      reply_to: Email?
      
      subject: String { max_length: 998 }
      body: String
      html_body: String?
      
      from_address: Email?
      from_name: String?
      
      attachments: List<Attachment>?
      priority: NotificationPriority?
      
      tags: Map<String, String>?
    }
    
    output {
      success: Notification
      errors {
        INVALID_RECIPIENT { when: "Email address is invalid" }
        RATE_LIMITED { retriable: true, retry_after: 1.minute }
        RECIPIENT_UNSUBSCRIBED { when: "Recipient has unsubscribed" }
      }
    }
    
    postconditions {
      success implies {
        Notification.exists(result.id)
        result.channel == EMAIL
        result.subject == input.subject
        result.body == input.body
      }
    }
    
    temporal {
      response within 500.ms (p99)
    }
  }
}
