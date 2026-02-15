# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TemplateNotFoundError, TemplateInactiveError, TemplateRenderError, InvalidVariableError, MissingVariableError, RecipientNotFoundError, ChannelNotConfiguredError, UnsubscribedError, QuietHoursError, RateLimitedError, ProviderError, DeliveryExpiredError, DeliveryFailedError, ConfigurationError, InvalidConfigurationError, EmailValidationError, PhoneValidationError, DeviceTokenError, WebhookError, BatchTooLargeError, PartialBatchError, NotificationError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type TemplateNotFoundError = String
  type TemplateInactiveError = String
  type TemplateRenderError = String
  type InvalidVariableError = String
  type MissingVariableError = String
  type RecipientNotFoundError = String
  type ChannelNotConfiguredError = String
  type UnsubscribedError = String
  type QuietHoursError = String
  type RateLimitedError = String
  type ProviderError = String
  type DeliveryExpiredError = String
  type DeliveryFailedError = String
  type ConfigurationError = String
  type InvalidConfigurationError = String
  type EmailValidationError = String
  type PhoneValidationError = String
  type DeviceTokenError = String
  type WebhookError = String
  type BatchTooLargeError = String
  type PartialBatchError = String

  invariants exports_present {
    - true
  }
}
