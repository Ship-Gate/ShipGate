# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPaymentError, CardDeclinedError, InsufficientFundsError, InvalidCardError, ExpiredCardError, AuthenticationRequiredError, FraudDetectedError, DuplicateRequestError, IdempotencyConflictError, RateLimitedError, ProviderUnavailableError, InvalidAmountError, CurrencyNotSupportedError, PaymentNotFoundError, PaymentNotRefundableError, AmountExceedsAvailableError, RefundWindowExpiredError, InvalidSignatureError, StaleEventError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type CardDeclinedError = String
  type InsufficientFundsError = String
  type InvalidCardError = String
  type ExpiredCardError = String
  type AuthenticationRequiredError = String
  type FraudDetectedError = String
  type DuplicateRequestError = String
  type IdempotencyConflictError = String
  type RateLimitedError = String
  type ProviderUnavailableError = String
  type InvalidAmountError = String
  type CurrencyNotSupportedError = String
  type PaymentNotFoundError = String
  type PaymentNotRefundableError = String
  type AmountExceedsAvailableError = String
  type RefundWindowExpiredError = String
  type InvalidSignatureError = String
  type StaleEventError = String

  invariants exports_present {
    - true
  }
}
