// ============================================================================
// SendPush Behavior
// ============================================================================
// Send push notifications to mobile devices
// ============================================================================

domain Notifications {
  
  behavior SendPush {
    description: "Send a push notification"
    
    actors {
      sender: {
        with_permission: "notifications:send:push"
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      // Device targeting
      device_token: DeviceToken
      platform: PushPlatform?  // Inferred from token if not provided
      
      // Template
      template_id: TemplateId
      variables: Map<String, String>
      
      // Direct content (alternative)
      title: String?
      body: String?
      
      // iOS specific
      badge: Int?
      sound: String?
      content_available: Boolean?  // Silent push
      mutable_content: Boolean?    // For notification extensions
      category: String?            // Action category
      thread_id: String?           // Grouping
      
      // Android specific
      icon: String?
      color: String?
      click_action: String?
      channel_id: String?          // Android notification channel
      
      // Data payload
      data: Map<String, String>?
      
      // Options
      priority: NotificationPriority?
      ttl: Duration?                // Time to live
      collapse_key: String?         // Replace previous notification
      
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
        INVALID_TOKEN {
          when: "Device token is invalid or expired"
        }
        UNREGISTERED_DEVICE {
          when: "Device is no longer registered for push"
        }
        PAYLOAD_TOO_LARGE {
          when: "Notification payload exceeds platform limit"
        }
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
          retry_after: 10.seconds
        }
        PROVIDER_ERROR {
          when: "Push provider returned an error"
          retriable: true
        }
        INVALID_PLATFORM {
          when: "Platform not supported or misconfigured"
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      // Template must exist and be for push
      Template.exists(input.template_id)
      Template.lookup(input.template_id).channel == PUSH
      Template.lookup(input.template_id).active == true
      
      // Valid device token
      input.device_token.length >= 32
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        // Notification created
        Notification.exists(result.id)
        result.channel == PUSH
        result.device_token == input.device_token
        result.template_id == input.template_id
        result.status in [PENDING, QUEUED, SENT]
        
        // iOS specific fields
        input.badge != null implies result.badge == input.badge
        input.sound != null implies result.sound == input.sound
        
        // Data payload captured
        input.data != null implies result.data == input.data
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Idempotency
      same(input.idempotency_key) implies same(result)
      
      // Platform payload limits
      platform == IOS implies payload_size <= 4096
      platform == ANDROID implies payload_size <= 4096
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      // API response time
      response within 200.ms (p99)
      response within 50.ms (p50)
      
      // Delivery is best-effort (no guaranteed delivery time)
      eventually within 1.minute: result.status in [SENT, FAILED]
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("notifications:send:push")
      
      // High throughput allowed for push
      rate_limit: 1000.per_minute per sender
      rate_limit: 100.per_minute per input.device_token
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter push_sent { labels: [template_id, platform, status] }
        counter push_delivered { labels: [template_id, platform] }
        counter push_opened { labels: [template_id, platform] }
        histogram push_delivery_time { labels: [platform] }
      }
      
      traces {
        span: "send_push"
        attributes: [template_id, platform]
      }
    }
  }
  
  // ==========================================================================
  // PLATFORM ENUM
  // ==========================================================================
  
  enum PushPlatform {
    IOS
    ANDROID
    WEB
    HUAWEI
    AMAZON
  }
  
  // ==========================================================================
  // SEND PUSH DIRECT
  // ==========================================================================
  
  behavior SendPushDirect {
    description: "Send push notification without template"
    
    input {
      device_token: DeviceToken
      platform: PushPlatform?
      title: String { max_length: 100 }
      body: String { max_length: 1000 }
      badge: Int?
      sound: String?
      data: Map<String, String>?
      priority: NotificationPriority?
      ttl: Duration?
      collapse_key: String?
    }
    
    output {
      success: Notification
      errors {
        INVALID_TOKEN { when: "Device token is invalid" }
        PAYLOAD_TOO_LARGE { when: "Payload exceeds limit" }
        RATE_LIMITED { retriable: true }
      }
    }
    
    postconditions {
      success implies {
        Notification.exists(result.id)
        result.channel == PUSH
        result.body == input.body
      }
    }
  }
  
  // ==========================================================================
  // SEND TO TOPIC (Firebase-style)
  // ==========================================================================
  
  behavior SendPushToTopic {
    description: "Send push notification to a topic (all subscribed devices)"
    
    input {
      topic: String { pattern: /^[a-zA-Z0-9-_.~%]+$/ }
      template_id: TemplateId
      variables: Map<String, String>
      title: String?
      body: String?
      data: Map<String, String>?
      priority: NotificationPriority?
    }
    
    output {
      success: {
        message_id: String
        topic: String
      }
      errors {
        TEMPLATE_NOT_FOUND { }
        INVALID_TOPIC { when: "Topic name is invalid" }
        RATE_LIMITED { retriable: true }
      }
    }
    
    temporal {
      response within 500.ms (p99)
    }
  }
  
  // ==========================================================================
  // REGISTER DEVICE
  // ==========================================================================
  
  behavior RegisterDevice {
    description: "Register a device for push notifications"
    
    input {
      user_id: String
      device_token: DeviceToken
      platform: PushPlatform
      device_name: String?
      app_version: String?
    }
    
    output {
      success: {
        device_id: UUID
        user_id: String
        registered_at: Timestamp
      }
      errors {
        INVALID_TOKEN { when: "Device token is invalid" }
        DEVICE_LIMIT_EXCEEDED { when: "User has too many registered devices" }
      }
    }
    
    postconditions {
      success implies {
        DeviceRegistry.exists(result.device_id)
      }
    }
  }
  
  behavior UnregisterDevice {
    description: "Unregister a device from push notifications"
    
    input {
      device_token: DeviceToken
    }
    
    output {
      success: Boolean
      errors {
        DEVICE_NOT_FOUND { when: "Device not registered" }
      }
    }
  }
}
