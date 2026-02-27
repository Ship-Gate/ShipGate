# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifyStripeSignature, verifyBraintreeSignature, verifyAdyenSignature, WebhookProcessorConfig, ProcessWebhookInput, ProcessWebhookError, WebhookProcessor
# dependencies: crypto

domain Webhooks {
  version: "1.0.0"

  type WebhookProcessorConfig = String
  type ProcessWebhookInput = String
  type ProcessWebhookError = String
  type WebhookProcessor = String

  invariants exports_present {
    - true
  }
}
