# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: withVerificationSpan, TraceVerification, createVerificationSpan, VerificationSpanConfig, CheckResult, CoverageMetrics, VerificationResult, VerificationSpan, VerificationSpanBuilder
# dependencies: @opentelemetry/api

domain Verification {
  version: "1.0.0"

  type VerificationSpanConfig = String
  type CheckResult = String
  type CoverageMetrics = String
  type VerificationResult = String
  type VerificationSpan = String
  type VerificationSpanBuilder = String

  invariants exports_present {
    - true
  }
}
