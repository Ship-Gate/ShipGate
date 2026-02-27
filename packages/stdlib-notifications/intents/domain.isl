// ============================================================================
// Notifications Domain - Multi-channel Messaging
// Version: 1.0.0
// ============================================================================

domain Notifications {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type NotificationId = UUID
  type TemplateId = String { pattern: /^[a-z][a-z0-9_-]*$/ }
  type RecipientId = UUID
  
  type Email = String { format: email }
  type PhoneNumber = String { pattern: /^\+[1-9]\d{1,14}$/ }  // E.164
  type DeviceToken = String { max_length: 256 }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum Channel {
    EMAIL
    SMS
    PUSH
    IN_APP
    WEBHOOK
    SLACK
    TEAMS
    DISCORD
  }
  
  enum NotificationStatus {
    QUEUED
    SENDING
    SENT
    DELIVERED
    FAILED
    BOUNCED
    UNSUBSCRIBED
  }
  
  enum Priority {
    CRITICAL     // Immediate delivery, bypass quiet hours
    HIGH         // Priority delivery
    NORMAL       // Standard delivery
    LOW          // Can be batched/delayed
    DIGEST       // Include in digest only
  }
  
  enum EmailProvider {
    SENDGRID
    MAILGUN
    SES
    POSTMARK
    RESEND
    SMTP
  }
  
  enum SMSProvider {
    TWILIO
    VONAGE
    PLIVO
    AWS_SNS
  }
  
  enum PushProvider {
    FCM           // Firebase Cloud Messaging
    APNS          // Apple Push Notification Service
    WEB_PUSH
    EXPO
  }
  
  // ============================================================================
  // NOTIFICATION ENTITY
  // ============================================================================
  
  entity Notification {
    id: NotificationId [immutable, unique, indexed]
    
    // Template
    template_id: TemplateId [indexed]
    
    // Recipient
    recipient_id: RecipientId [indexed]
    recipient_email: Email?
    recipient_phone: PhoneNumber?
    recipient_device_token: DeviceToken?
    
    // Channel
    channel: Channel [indexed]
    
    // Content (rendered from template)
    subject: String?
    body: String
    html_body: String?
    
    // Rich content
    attachments: List<Attachment>?
    actions: List<NotificationAction>?
    
    // Metadata
    priority: Priority
    category: String?
    tags: List<String>?
    data: Map<String, Any>?
    
    // Tracking
    status: NotificationStatus [indexed]
    provider: String?
    provider_message_id: String?
    
    // Events
    sent_at: Timestamp?
    delivered_at: Timestamp?
    opened_at: Timestamp?
    clicked_at: Timestamp?
    failed_at: Timestamp?
    failure_reason: String?
    
    // Scheduling
    scheduled_at: Timestamp?
    expires_at: Timestamp?
    
    // Idempotency
    idempotency_key: String? [unique]
    
    // Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    // ============================================================================
    // INVARIANTS
    // ============================================================================
    
    invariants {
      // Channel-specific recipient required
      channel == EMAIL implies recipient_email != null
      channel == SMS implies recipient_phone != null
      channel == PUSH implies recipient_device_token != null
      
      // Status consistency
      status == SENT implies sent_at != null
      status == DELIVERED implies delivered_at != null
      status == FAILED implies failed_at != null and failure_reason != null
      
      // Scheduling
      scheduled_at != null implies scheduled_at > created_at
      expires_at != null implies expires_at > (scheduled_at ?? created_at)
    }
    
    // ============================================================================
    // COMPUTED
    // ============================================================================
    
    computed {
      is_delivered: Boolean = status == DELIVERED
      is_failed: Boolean = status in [FAILED, BOUNCED]
      is_pending: Boolean = status in [QUEUED, SENDING]
      was_opened: Boolean = opened_at != null
      was_clicked: Boolean = clicked_at != null
      delivery_latency: Duration? = delivered_at != null and sent_at != null
        ? delivered_at - sent_at
        : null
    }
  }
  
  type Attachment = {
    filename: String
    content_type: String
    url: String?
    content: String?  // Base64 for inline
    size: Int?
  }
  
  type NotificationAction = {
    id: String
    label: String
    url: String?
    action_type: ActionType
  }
  
  enum ActionType {
    LINK
    BUTTON
    DEEP_LINK
    DISMISS
    REPLY
  }
  
  // ============================================================================
  // TEMPLATE ENTITY
  // ============================================================================
  
  entity Template {
    id: TemplateId [unique]
    name: String
    description: String?
    
    // Channel-specific templates
    channels: Map<Channel, ChannelTemplate>
    
    // Variables
    variables: List<TemplateVariable>
    
    // Localization
    default_locale: String
    locales: List<String>
    
    // Settings
    category: String?
    priority: Priority?
    
    // Status
    active: Boolean
    
    // Versioning
    version: Int { min: 1 }
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      channels.size > 0
      default_locale in locales
    }
  }
  
  type ChannelTemplate = {
    subject: String?
    body: String
    html_body: String?
    // Push-specific
    title: String?
    image_url: String?
    sound: String?
    badge: Int?
  }
  
  type TemplateVariable = {
    name: String
    type: VariableType
    required: Boolean
    default_value: Any?
    description: String?
  }
  
  enum VariableType {
    STRING
    NUMBER
    BOOLEAN
    DATE
    LIST
    OBJECT
  }
  
  // ============================================================================
  // RECIPIENT PREFERENCES
  // ============================================================================
  
  entity RecipientPreferences {
    recipient_id: RecipientId [unique]
    
    // Global preferences
    enabled: Boolean
    quiet_hours: QuietHours?
    timezone: String?
    locale: String?
    
    // Channel preferences
    channel_preferences: Map<Channel, ChannelPreference>
    
    // Category preferences (opt-in/out per category)
    category_preferences: Map<String, Boolean>
    
    // Unsubscribed categories
    unsubscribed_categories: List<String>
    
    // Frequency limits
    digest_enabled: Boolean
    digest_frequency: DigestFrequency?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  type QuietHours = {
    enabled: Boolean
    start: Time   // e.g., "22:00"
    end: Time     // e.g., "08:00"
    days: List<DayOfWeek>?  // If null, applies to all days
  }
  
  type Time = String { pattern: /^\d{2}:\d{2}$/ }
  
  enum DayOfWeek {
    MONDAY
    TUESDAY
    WEDNESDAY
    THURSDAY
    FRIDAY
    SATURDAY
    SUNDAY
  }
  
  type ChannelPreference = {
    enabled: Boolean
    address: String?  // Override default
  }
  
  enum DigestFrequency {
    HOURLY
    DAILY
    WEEKLY
  }
  
  // ============================================================================
  // BEHAVIORS
  // ============================================================================
  
  behavior Send {
    description: "Send a notification"
    
    input {
      template_id: TemplateId
      recipient_id: RecipientId
      channel: Channel?           // If null, use recipient preference
      channels: List<Channel>?    // Send to multiple channels
      
      // Template variables
      variables: Map<String, Any>
      
      // Overrides
      subject: String?
      body: String?
      
      // Metadata
      priority: Priority?
      category: String?
      tags: List<String>?
      data: Map<String, Any>?
      
      // Scheduling
      scheduled_at: Timestamp?
      expires_at: Timestamp?
      
      // Options
      respect_preferences: Boolean?
      bypass_quiet_hours: Boolean?
      
      // Idempotency
      idempotency_key: String?
    }
    
    output {
      success: SendResult
      errors {
        TEMPLATE_NOT_FOUND { }
        RECIPIENT_NOT_FOUND { }
        CHANNEL_NOT_CONFIGURED { when: "Recipient has no address for channel" }
        UNSUBSCRIBED { when: "Recipient unsubscribed from this category" }
        INVALID_VARIABLES { when: "Required template variables missing" }
        RATE_LIMITED { retriable: true, retry_after: 1.minute }
        PROVIDER_ERROR { retriable: true }
        EXPIRED { when: "Notification has expired" }
      }
    }
    
    preconditions {
      Template.exists(input.template_id)
      Template.lookup(input.template_id).active
      input.scheduled_at == null or input.scheduled_at > now()
    }
    
    postconditions {
      success implies {
        all(result.notifications, n => Notification.exists(n.id))
        result.notifications.length > 0
      }
    }
    
    temporal {
      response within 200.ms (p99)
      
      // Non-scheduled notifications should be sent quickly
      input.scheduled_at == null and input.priority in [CRITICAL, HIGH] implies {
        eventually within 10.seconds: notification_sent
      }
    }
    
    observability {
      metrics {
        notifications_sent: counter { labels: [template, channel, priority, status] }
        notification_latency: histogram { labels: [channel] }
      }
    }
  }
  
  behavior SendBatch {
    description: "Send notifications to multiple recipients"
    
    input {
      template_id: TemplateId
      recipients: List<BatchRecipient> { max_length: 10000 }
      channel: Channel?
      priority: Priority?
      category: String?
      scheduled_at: Timestamp?
    }
    
    output {
      success: { 
        queued: Int
        failed: Int
        errors: List<{ recipient_id: RecipientId, error: String }>
      }
      errors {
        TEMPLATE_NOT_FOUND { }
        BATCH_TOO_LARGE { }
      }
    }
    
    temporal {
      response within 5.seconds (p99)
    }
  }
  
  behavior SendTransactional {
    description: "Send a high-priority transactional notification"
    
    input {
      template_id: TemplateId
      recipient: TransactionalRecipient
      variables: Map<String, Any>
      channel: Channel
    }
    
    output {
      success: Notification
      errors {
        TEMPLATE_NOT_FOUND { }
        DELIVERY_FAILED { retriable: true }
      }
    }
    
    // Transactional notifications have strict SLAs
    temporal {
      response within 100.ms (p99)
      eventually within 30.seconds: notification_delivered
    }
  }
  
  behavior GetStatus {
    description: "Get notification delivery status"
    
    input {
      notification_id: NotificationId
    }
    
    output {
      success: NotificationStatus
      errors {
        NOTIFICATION_NOT_FOUND { }
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
  }
  
  behavior UpdatePreferences {
    description: "Update recipient notification preferences"
    
    input {
      recipient_id: RecipientId
      
      // Updates (partial)
      enabled: Boolean?
      quiet_hours: QuietHours?
      channel_preferences: Map<Channel, ChannelPreference>?
      category_preferences: Map<String, Boolean>?
    }
    
    output {
      success: RecipientPreferences
      errors {
        RECIPIENT_NOT_FOUND { }
      }
    }
    
    security {
      requires authentication
      actor.id == input.recipient_id or actor.has_role("admin")
    }
  }
  
  behavior Unsubscribe {
    description: "Unsubscribe from notifications"
    
    input {
      recipient_id: RecipientId
      category: String?      // Unsubscribe from specific category
      channel: Channel?      // Unsubscribe from specific channel
      all: Boolean?          // Unsubscribe from all
      token: String?         // One-click unsubscribe token
    }
    
    output {
      success: RecipientPreferences
      errors {
        RECIPIENT_NOT_FOUND { }
        INVALID_TOKEN { }
      }
    }
    
    postconditions {
      success implies {
        input.all implies RecipientPreferences.lookup(input.recipient_id).enabled == false
        input.category != null implies input.category in RecipientPreferences.lookup(input.recipient_id).unsubscribed_categories
      }
    }
    
    compliance {
      gdpr { this satisfies right_to_object }
      can_spam { must_honor_unsubscribe }
    }
  }
  
  behavior TrackEvent {
    description: "Track notification event (open, click, etc.)"
    
    input {
      notification_id: NotificationId
      event: TrackingEvent
      metadata: Map<String, String>?
    }
    
    output {
      success: Boolean
      errors {
        NOTIFICATION_NOT_FOUND { }
      }
    }
    
    postconditions {
      success implies {
        input.event == OPENED implies Notification.lookup(input.notification_id).opened_at != null
        input.event == CLICKED implies Notification.lookup(input.notification_id).clicked_at != null
      }
    }
  }
  
  // ============================================================================
  // TYPES
  // ============================================================================
  
  type SendResult = {
    notifications: List<Notification>
    channels_sent: List<Channel>
    channels_skipped: List<{ channel: Channel, reason: String }>
  }
  
  type BatchRecipient = {
    recipient_id: RecipientId
    variables: Map<String, Any>?
    priority: Priority?
  }
  
  type TransactionalRecipient = {
    email: Email?
    phone: PhoneNumber?
    device_token: DeviceToken?
  }
  
  enum TrackingEvent {
    OPENED
    CLICKED
    CONVERTED
    DISMISSED
    COMPLAINED
    UNSUBSCRIBED
  }
  
  // ============================================================================
  // DIGEST SUPPORT
  // ============================================================================
  
  behavior ProcessDigests {
    description: "Process and send notification digests"
    
    actors {
      system: Internal
    }
    
    input {
      frequency: DigestFrequency
    }
    
    output {
      success: { processed: Int, sent: Int }
      errors { }
    }
    
    // Run on schedule
    schedule {
      HOURLY: "0 * * * *"      // Every hour
      DAILY: "0 8 * * *"       // Every day at 8am
      WEEKLY: "0 8 * * 1"      // Every Monday at 8am
    }
  }
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants NotificationInvariants {
    scope: global
    
    always {
      // Delivered notifications must have delivery timestamp
      all(Notification, n => n.status == DELIVERED implies n.delivered_at != null)
      
      // Unsubscribed recipients don't receive notifications
      all(RecipientPreferences, p => 
        not p.enabled implies 
        not Notification.exists(recipient_id: p.recipient_id, status: QUEUED)
      )
      
      // Respect quiet hours
      all(RecipientPreferences, p =>
        p.quiet_hours.enabled and is_quiet_hours(p.quiet_hours, now()) implies
        not Notification.exists(
          recipient_id: p.recipient_id, 
          status: QUEUED, 
          priority != CRITICAL
        )
      )
    }
  }
}
