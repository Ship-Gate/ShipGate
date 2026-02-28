# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVerificationMetrics, VerificationMetrics, VerificationBatchResult
# dependencies: @opentelemetry/sdk-metrics, @opentelemetry/api

domain Verification {
  version: "1.0.0"

  type VerificationMetrics = String
  type VerificationBatchResult = String

  invariants exports_present {
    - true
  }
}
