# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: UUID, Timestamp, NotificationId, TemplateId, RecipientId, Email, PhoneNumber, DeviceToken, Attachment, NotificationAction, Notification, CreateNotificationInput, SendResult, BatchRecipient, TransactionalRecipient, TemplateVariable, ChannelTemplate, Template, RenderContext, QuietHours, ChannelPreference, RecipientPreferences, DeliveryEvent, DeliveryStats, NotificationError, Clock, DefaultClock
# dependencies: 

domain Types {
  version: "1.0.0"

  type UUID = String
  type Timestamp = String
  type NotificationId = String
  type TemplateId = String
  type RecipientId = String
  type Email = String
  type PhoneNumber = String
  type DeviceToken = String
  type Attachment = String
  type NotificationAction = String
  type Notification = String
  type CreateNotificationInput = String
  type SendResult = String
  type BatchRecipient = String
  type TransactionalRecipient = String
  type TemplateVariable = String
  type ChannelTemplate = String
  type Template = String
  type RenderContext = String
  type QuietHours = String
  type ChannelPreference = String
  type RecipientPreferences = String
  type DeliveryEvent = String
  type DeliveryStats = String
  type NotificationError = String
  type Clock = String
  type DefaultClock = String

  invariants exports_present {
    - true
  }
}
