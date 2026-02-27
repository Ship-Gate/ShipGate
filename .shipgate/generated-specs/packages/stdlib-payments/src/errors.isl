# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PaymentError, CardError, ValidationError, ApiError, GatewayError, IdempotencyError, CheckoutError, RefundError, WebhookError, ErrorFactory
# dependencies: 

domain Errors {
  version: "1.0.0"

  type PaymentError = String
  type CardError = String
  type ValidationError = String
  type ApiError = String
  type GatewayError = String
  type IdempotencyError = String
  type CheckoutError = String
  type RefundError = String
  type WebhookError = String
  type ErrorFactory = String

  invariants exports_present {
    - true
  }
}
