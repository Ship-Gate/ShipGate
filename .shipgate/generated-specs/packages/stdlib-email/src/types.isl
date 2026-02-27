# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EmailAddress, EmailMessage, Attachment, EmailTemplate, TemplateVariable, EmailDeliveryResult, DeliveryError, EmailBatch, BatchRecipient, DeliveryStats, EmailPriority, EmailStatus, DeliveryStatus, AttachmentDisposition, VariableType, ErrorCategory, BatchStatus, EmailProvider, NormalizedEmail, NormalizedAttachment, ProviderConfig, TemplateEngine, TemplateValidation, TemplateError, TemplateWarning, EmailEvent, EmailEventType, WebhookPayload, EmailConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type EmailAddress = String
  type EmailMessage = String
  type Attachment = String
  type EmailTemplate = String
  type TemplateVariable = String
  type EmailDeliveryResult = String
  type DeliveryError = String
  type EmailBatch = String
  type BatchRecipient = String
  type DeliveryStats = String
  type EmailPriority = String
  type EmailStatus = String
  type DeliveryStatus = String
  type AttachmentDisposition = String
  type VariableType = String
  type ErrorCategory = String
  type BatchStatus = String
  type EmailProvider = String
  type NormalizedEmail = String
  type NormalizedAttachment = String
  type ProviderConfig = String
  type TemplateEngine = String
  type TemplateValidation = String
  type TemplateError = String
  type TemplateWarning = String
  type EmailEvent = String
  type EmailEventType = String
  type WebhookPayload = String
  type EmailConfig = String

  invariants exports_present {
    - true
  }
}
