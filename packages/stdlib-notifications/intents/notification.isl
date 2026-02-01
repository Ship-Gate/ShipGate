// ============================================================================
// Notification Entity
// ============================================================================
// Core notification record tracking delivery status
// ============================================================================

domain Notifications {
  
  entity Notification {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    id: NotificationId [immutable, unique, indexed]
    
    // ========================================================================
    // CHANNEL & RECIPIENT
    // ========================================================================
    
    channel: NotificationChannel [immutable]
    recipient: String [immutable, pii, indexed]
    
    // For email
    cc: List<Email>?
    bcc: List<Email>?
    reply_to: Email?
    
    // For push
    device_token: DeviceToken?
    
    // ========================================================================
    // CONTENT
    // ========================================================================
    
    template_id: TemplateId [indexed]
    variables: Map<String, String>
    
    // Rendered content (after template processing)
    subject: String?
    body: String?
    
    // Email attachments
    attachments: List<Attachment>?
    
    // Push-specific
    badge: Int?
    sound: String?
    data: Map<String, String>?
    
    // ========================================================================
    // METADATA
    // ========================================================================
    
    priority: NotificationPriority { default: NORMAL }
    tags: Map<String, String>
    
    // Tracking
    correlation_id: UUID?
    campaign_id: String?
    
    // Sender info
    sender_id: String [indexed]
    from_address: String?
    from_name: String?
    
    // ========================================================================
    // TIMESTAMPS
    // ========================================================================
    
    created_at: Timestamp [immutable]
    scheduled_at: Timestamp?
    queued_at: Timestamp?
    sent_at: Timestamp?
    delivered_at: Timestamp?
    opened_at: Timestamp?
    clicked_at: Timestamp?
    failed_at: Timestamp?
    
    // ========================================================================
    // STATUS & DELIVERY
    // ========================================================================
    
    status: NotificationStatus { default: PENDING }
    
    // Provider info
    provider: String?
    provider_message_id: String?
    
    // Error tracking
    error_code: String?
    error_message: String?
    
    // Bounce info (email)
    bounce_type: BounceType?
    bounce_reason: String?
    
    // Retry tracking
    retry_count: Int { default: 0 }
    max_retries: Int { default: 3 }
    next_retry_at: Timestamp?
    
    // Delivery attempts history
    delivery_attempts: List<DeliveryAttempt>
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Retry count is bounded
      retry_count >= 0
      retry_count <= max_retries + 1
      
      // Status timestamp consistency
      sent_at != null implies status in [SENT, DELIVERED, OPENED, CLICKED, BOUNCED, FAILED]
      delivered_at != null implies sent_at != null
      opened_at != null implies delivered_at != null
      clicked_at != null implies opened_at != null
      
      // Channel-specific validation
      channel == EMAIL implies recipient matches Email
      channel == SMS implies recipient matches Phone
      channel == PUSH implies device_token != null
      
      // Bounce requires sent status first
      bounce_type != null implies status == BOUNCED
      status == BOUNCED implies sent_at != null
      
      // Failed status consistency
      status == FAILED implies (error_code != null or error_message != null)
      
      // Priority queue ordering
      priority == URGENT implies scheduled_at == null or scheduled_at <= now()
    }
    
    // ========================================================================
    // LIFECYCLE
    // ========================================================================
    
    lifecycle {
      // Normal flow
      PENDING -> QUEUED
      QUEUED -> SENT
      SENT -> DELIVERED
      DELIVERED -> OPENED
      OPENED -> CLICKED
      
      // Failure flows
      PENDING -> FAILED
      QUEUED -> FAILED
      SENT -> FAILED
      SENT -> BOUNCED
      
      // Unsubscribe
      DELIVERED -> UNSUBSCRIBED
      OPENED -> UNSUBSCRIBED
    }
  }
  
  // ==========================================================================
  // NOTIFICATION OPERATIONS
  // ==========================================================================
  
  behavior GetNotification {
    description: "Retrieve notification by ID"
    
    input {
      id: NotificationId
    }
    
    output {
      success: Notification
      errors {
        NOT_FOUND { when: "Notification does not exist" }
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
  }
  
  behavior ListNotifications {
    description: "List notifications with filtering"
    
    input {
      recipient: String?
      channel: NotificationChannel?
      status: NotificationStatus?
      campaign_id: String?
      from_date: Timestamp?
      to_date: Timestamp?
      limit: Int { default: 50, max: 200 }
      cursor: String?
    }
    
    output {
      success: {
        notifications: List<Notification>
        next_cursor: String?
        total_count: Int?
      }
      errors {
        INVALID_FILTER { when: "Invalid filter parameters" }
      }
    }
    
    temporal {
      response within 200.ms (p99)
    }
  }
  
  behavior CancelNotification {
    description: "Cancel a pending notification"
    
    input {
      id: NotificationId
    }
    
    output {
      success: Boolean
      errors {
        NOT_FOUND { when: "Notification does not exist" }
        ALREADY_SENT { when: "Notification has already been sent" }
      }
    }
    
    preconditions {
      Notification.exists(input.id)
      Notification.lookup(input.id).status in [PENDING, QUEUED]
    }
    
    postconditions {
      success implies Notification.lookup(input.id).status == FAILED
    }
  }
  
  behavior RetryNotification {
    description: "Retry a failed notification"
    
    input {
      id: NotificationId
    }
    
    output {
      success: Notification
      errors {
        NOT_FOUND { when: "Notification does not exist" }
        NOT_FAILED { when: "Notification is not in failed state" }
        MAX_RETRIES { when: "Maximum retry attempts exceeded" }
      }
    }
    
    preconditions {
      Notification.exists(input.id)
      Notification.lookup(input.id).status == FAILED
      Notification.lookup(input.id).retry_count < Notification.lookup(input.id).max_retries
    }
    
    postconditions {
      success implies {
        result.status == PENDING
        result.retry_count == old(Notification.lookup(input.id).retry_count) + 1
      }
    }
  }
}
