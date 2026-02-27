# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: smsStore, NotificationId, Phone, NotificationStatus, NotificationPriority, SMSNotification, SendSMSInput, SendSMSDirectInput, SendVerificationSMSInput, VerificationResult, SMSError, SMSStore
# dependencies: crypto

domain Sms {
  version: "1.0.0"

  type NotificationId = String
  type Phone = String
  type NotificationStatus = String
  type NotificationPriority = String
  type SMSNotification = String
  type SendSMSInput = String
  type SendSMSDirectInput = String
  type SendVerificationSMSInput = String
  type VerificationResult = String
  type SMSError = String
  type SMSStore = String

  invariants exports_present {
    - true
  }
}
