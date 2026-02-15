# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: capturePayment, CapturePaymentInput, CapturePaymentResult, CapturePaymentConfig
# dependencies: 

domain CapturePayment {
  version: "1.0.0"

  type CapturePaymentInput = String
  type CapturePaymentResult = String
  type CapturePaymentConfig = String

  invariants exports_present {
    - true
  }
}
