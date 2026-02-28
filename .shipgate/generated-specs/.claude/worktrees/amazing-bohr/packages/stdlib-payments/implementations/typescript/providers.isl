# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createProvider, PaymentProviderAdapter, ProviderCreatePaymentInput, ProviderPaymentResult, ProviderCapturePaymentInput, ProviderCaptureResult, ProviderRefundPaymentInput, ProviderRefundResult, StripeConfig, StripeProvider, BraintreeConfig, BraintreeProvider, AdyenConfig, AdyenProvider, SquareConfig, SquareProvider, ProviderConfig
# dependencies: crypto

domain Providers {
  version: "1.0.0"

  type PaymentProviderAdapter = String
  type ProviderCreatePaymentInput = String
  type ProviderPaymentResult = String
  type ProviderCapturePaymentInput = String
  type ProviderCaptureResult = String
  type ProviderRefundPaymentInput = String
  type ProviderRefundResult = String
  type StripeConfig = String
  type StripeProvider = String
  type BraintreeConfig = String
  type BraintreeProvider = String
  type AdyenConfig = String
  type AdyenProvider = String
  type SquareConfig = String
  type SquareProvider = String
  type ProviderConfig = String

  invariants exports_present {
    - true
  }
}
