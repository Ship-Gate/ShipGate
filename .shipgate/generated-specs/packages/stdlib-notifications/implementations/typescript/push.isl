# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: pushStore, NotificationId, DeviceToken, NotificationStatus, NotificationPriority, PushPlatform, PushNotification, SendPushInput, SendPushDirectInput, DeviceRegistration, PushError, PushStore
# dependencies: crypto

domain Push {
  version: "1.0.0"

  type NotificationId = String
  type DeviceToken = String
  type NotificationStatus = String
  type NotificationPriority = String
  type PushPlatform = String
  type PushNotification = String
  type SendPushInput = String
  type SendPushDirectInput = String
  type DeviceRegistration = String
  type PushError = String
  type PushStore = String

  invariants exports_present {
    - true
  }
}
