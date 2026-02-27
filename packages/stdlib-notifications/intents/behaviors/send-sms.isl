// ============================================================================
// SendSMS Behavior
// ============================================================================
// Send SMS/text message notifications
// ============================================================================

domain Notifications {
  
  behavior SendSMS {
    description: "Send an SMS notification"
    
    actors {
      sender: {
        with_permission: "notifications:send:sms"
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      // Recipient
      to: Phone
      
      // Template
      template_id: TemplateId
      variables: Map<String, String>
      
      // Direct message (alternative to template)
      message: String?
      
      // Sender ID (if supported by carrier)
      from: String?
      
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
        INVALID_PHONE {
          when: "Phone number is invalid or unreachable"
        }
        MESSAGE_TOO_LONG {
          when: "Message exceeds maximum length (1600 characters)"
        }
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
          retry_after: 30.seconds
        }
        CARRIER_ERROR {
          when: "Mobile carrier returned an error"
          retriable: true
        }
        LANDLINE_NUMBER {
          when: "Phone number is a landline"
        }
        RECIPIENT_OPTED_OUT {
          when: "Recipient has opted out of SMS"
        }
        UNSUPPORTED_REGION {
          when: "SMS not supported in recipient's region"
        }
        INSUFFICIENT_CREDITS {
          when: "Not enough SMS credits"
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      // Template must exist and be for SMS
      Template.exists(input.template_id)
      Template.lookup(input.template_id).channel == SMS
      Template.lookup(input.template_id).active == true
      
      // Phone number in valid format
      input.to matches /^\+[1-9]\d{1,14}$/
      
      // Not opted out
      not OptOutList.contains(input.to, SMS)
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        // Notification created
        Notification.exists(result.id)
        result.channel == SMS
        result.recipient == input.to
        result.template_id == input.template_id
        result.status in [PENDING, QUEUED, SENT]
        
        // Message length within limit
        result.body != null implies result.body.length <= 1600
        
        // Scheduling respected
        input.scheduled_at != null implies result.scheduled_at == input.scheduled_at
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Idempotency
      same(input.idempotency_key) implies same(result)
      
      // Message segmentation (160 char per segment for GSM-7)
      result.body.length <= 160 implies segments == 1
      result.body.length > 160 implies segments == ceil(result.body.length / 153)
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      // API response time
      response within 1.second (p99)
      response within 200.ms (p50)
      
      // Delivery SLA
      eventually within 30.seconds: result.status in [SENT, FAILED]
      eventually within 5.minutes: result.status in [DELIVERED, FAILED]
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("notifications:send:sms")
      
      // Per-phone rate limits (prevent SMS bombing)
      rate_limit: 10.per_minute per input.to
      rate_limit: 100.per_day per input.to
      
      // Per-sender limits
      rate_limit: 60.per_minute per sender
      rate_limit: 10000.per_day per sender
    }
    
    // ========================================================================
    // COMPLIANCE
    // ========================================================================
    
    compliance {
      tcpa {
        prior_express_consent: required
        opt_out_mechanism: required
        time_restrictions: true  // 8am-9pm local time
        caller_id: required
      }
      
      ctia {
        content_standards: enforced
        opt_in_confirmation: required
        help_keyword: required
        stop_keyword: required
      }
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter sms_sent { labels: [template_id, status, region] }
        counter sms_delivered { labels: [template_id, region] }
        counter sms_segments { labels: [template_id] }
        histogram sms_delivery_time { labels: [region, carrier] }
        gauge sms_credits_remaining { }
      }
      
      traces {
        span: "send_sms"
        attributes: [template_id, region, carrier]
      }
      
      logs {
        on_success: info { 
          include: [notification_id, template_id, region]
          exclude: [recipient, message]  // PII
        }
        on_error: warn {
          include: [notification_id, error_code, region]
        }
      }
    }
  }
  
  // ==========================================================================
  // SEND SMS DIRECT
  // ==========================================================================
  
  behavior SendSMSDirect {
    description: "Send SMS without template"
    
    input {
      to: Phone
      message: String { max_length: 1600 }
      from: String?
      priority: NotificationPriority?
      tags: Map<String, String>?
    }
    
    output {
      success: Notification
      errors {
        INVALID_PHONE { when: "Phone number is invalid" }
        MESSAGE_TOO_LONG { when: "Message exceeds 1600 characters" }
        RATE_LIMITED { retriable: true, retry_after: 30.seconds }
        CARRIER_ERROR { retriable: true }
      }
    }
    
    postconditions {
      success implies {
        Notification.exists(result.id)
        result.channel == SMS
        result.body == input.message
      }
    }
  }
  
  // ==========================================================================
  // VERIFICATION SMS
  // ==========================================================================
  
  behavior SendVerificationSMS {
    description: "Send verification code via SMS"
    
    input {
      to: Phone
      code: String { pattern: /^\d{4,8}$/ }
      expires_in: Duration { default: 10.minutes, max: 1.hour }
      template_id: TemplateId?
    }
    
    output {
      success: {
        notification: Notification
        verification_id: UUID
        expires_at: Timestamp
      }
      errors {
        INVALID_PHONE { when: "Phone number is invalid" }
        RATE_LIMITED { retriable: true }
      }
    }
    
    security {
      rate_limit: 3.per_10_minutes per input.to
      rate_limit: 10.per_hour per input.to
    }
    
    temporal {
      response within 500.ms (p99)
      eventually within 10.seconds: result.notification.status == SENT
    }
  }
}
