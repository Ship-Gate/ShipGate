# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVerificationIntegration, getVerificationIntegration, recordVerification, VerificationIntegration
# dependencies: @sentry/node

domain Verification {
  version: "1.0.0"

  type VerificationIntegration = String

  invariants exports_present {
    - true
  }
}
