# Notifications Domain
# Multi-channel notification system with preferences and delivery tracking

domain Notifications {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type NotificationContent = String { max_length: 10000 }
  
  enum NotificationChannel {
    EMAIL
    PUSH
    SMS
    IN_APP
    WEBHOOK
    SLACK
  }
  
  enum NotificationPriority {
    LOW
    NORMAL
    HIGH
    URGENT
  }
  
  enum DeliveryStatus {
    PENDING
    QUEUED
    SENT
    DELIVERED
    FAILED
    BOUNCED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity NotificationTemplate {
    id: UUID [immutable, unique]
    slug: String [unique, indexed]
    name: String
    description: String?
    channels: List<NotificationChannel>
    subject_template: String?
    body_template: NotificationContent
    variables: List<String>
    is_active: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity Notification {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    template_id: UUID? [indexed]
    category: String [indexed]
    title: String
    body: NotificationContent
    data: Map<String, Any>?
    action_url: String?
    image_url: String?
    priority: NotificationPriority [default: NORMAL]
    channels: List<NotificationChannel>
    read: Boolean [default: false]
    read_at: Timestamp?
    archived: Boolean [default: false]
    expires_at: Timestamp?
    created_at: Timestamp [immutable, indexed]
    
    invariants {
      read_at != null implies read == true
    }
  }
  
  entity NotificationDelivery {
    id: UUID [immutable, unique]
    notification_id: UUID [indexed]
    channel: NotificationChannel [indexed]
    status: DeliveryStatus [default: PENDING]
    external_id: String?
    attempts: Int [default: 0]
    last_attempt_at: Timestamp?
    delivered_at: Timestamp?
    failed_reason: String?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    
    invariants {
      delivered_at != null implies status == DELIVERED
    }
  }
  
  entity NotificationPreferences {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    enabled_channels: Map<String, List<NotificationChannel>>
    muted_categories: List<String>
    quiet_hours: {
      enabled: Boolean
      start_time: String
      end_time: String
      timezone: String
    }?
    email_frequency: String [default: "immediate"]
    push_enabled: Boolean [default: true]
    sms_enabled: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior SendNotification {
    description: "Send a notification to a user"
    
    actors {
      System { }
      User { must: authenticated }
    }
    
    input {
      user_id: UUID
      template_slug: String?
      category: String
      title: String
      body: NotificationContent
      data: Map<String, Any>?
      action_url: String?
      channels: List<NotificationChannel>?
      priority: NotificationPriority?
      schedule_at: Timestamp?
    }
    
    output {
      success: {
        notification: Notification
        deliveries: List<NotificationDelivery>
      }
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        TEMPLATE_NOT_FOUND {
          when: "Notification template does not exist"
          retriable: false
        }
        ALL_CHANNELS_MUTED {
          when: "User has muted all channels for this category"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Notification.exists(result.notification.id)
        result.deliveries.length > 0
      }
    }
    
    temporal {
      response within 100ms
      input.schedule_at == null implies eventually within 30s: delivery_attempted
    }
  }
  
  behavior BulkSendNotification {
    description: "Send notification to multiple users"
    
    actors {
      System { }
    }
    
    input {
      user_ids: List<UUID>
      template_slug: String?
      category: String
      title: String
      body: NotificationContent
      data: Map<String, Any>?
    }
    
    output {
      success: {
        sent_count: Int
        failed_count: Int
        failed_users: List<UUID>?
      }
    }
    
    temporal {
      eventually within 5m: all_deliveries_attempted
    }
  }
  
  behavior MarkAsRead {
    description: "Mark notification(s) as read"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      notification_ids: List<UUID>?
      mark_all: Boolean?
      category: String?
    }
    
    output {
      success: {
        marked_count: Int
      }
    }
    
    postconditions {
      success implies {
        input.notification_ids != null implies 
          input.notification_ids.all(id => Notification.lookup(id).read == true)
      }
    }
  }
  
  behavior ArchiveNotification {
    description: "Archive notification(s)"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      notification_ids: List<UUID>?
      archive_all_read: Boolean?
    }
    
    output {
      success: {
        archived_count: Int
      }
    }
  }
  
  behavior ListNotifications {
    description: "Get user's notifications"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      read: Boolean?
      archived: Boolean [default: false]
      category: String?
      priority: NotificationPriority?
      limit: Int [default: 20, max: 100]
      cursor: String?
    }
    
    output {
      success: {
        notifications: List<Notification>
        unread_count: Int
        next_cursor: String?
      }
    }
  }
  
  behavior GetUnreadCount {
    description: "Get count of unread notifications"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        total: Int
        by_category: Map<String, Int>
      }
    }
    
    temporal {
      response within 50ms
    }
  }
  
  behavior UpdatePreferences {
    description: "Update notification preferences"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      enabled_channels: Map<String, List<NotificationChannel>>?
      muted_categories: List<String>?
      quiet_hours: {
        enabled: Boolean
        start_time: String
        end_time: String
        timezone: String
      }?
      email_frequency: String?
      push_enabled: Boolean?
      sms_enabled: Boolean?
    }
    
    output {
      success: NotificationPreferences
    }
  }
  
  behavior RegisterPushToken {
    description: "Register device push notification token"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      token: String
      platform: String [values: ["ios", "android", "web"]]
      device_id: String?
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_TOKEN {
          when: "Push token is invalid"
          retriable: false
        }
        MAX_DEVICES {
          when: "Maximum devices reached"
          retriable: false
        }
      }
    }
  }
  
  behavior UnsubscribeByToken {
    description: "Unsubscribe from notifications via email link"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: String
      category: String?
    }
    
    output {
      success: {
        unsubscribed: Boolean
        category: String?
      }
      
      errors {
        INVALID_TOKEN {
          when: "Unsubscribe token is invalid"
          retriable: false
        }
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios SendNotification {
    scenario "send multi-channel notification" {
      given {
        prefs = NotificationPreferences.create(
          user_id: user.id,
          enabled_channels: { "alerts": [EMAIL, PUSH, IN_APP] }
        )
      }
      
      when {
        result = SendNotification(
          user_id: user.id,
          category: "alerts",
          title: "New Alert",
          body: "Something happened",
          channels: [EMAIL, PUSH, IN_APP]
        )
      }
      
      then {
        result is success
        result.deliveries.length == 3
      }
    }
    
    scenario "respect quiet hours" {
      given {
        prefs = NotificationPreferences.create(
          user_id: user.id,
          quiet_hours: {
            enabled: true,
            start_time: "22:00",
            end_time: "08:00",
            timezone: "America/New_York"
          }
        )
      }
      
      when {
        // During quiet hours
        result = SendNotification(
          user_id: user.id,
          category: "updates",
          title: "Update",
          body: "...",
          priority: NORMAL
        )
      }
      
      then {
        result is success
        // Push notification should be queued for later
        result.deliveries.find(d => d.channel == PUSH).status == QUEUED
      }
    }
  }
}
