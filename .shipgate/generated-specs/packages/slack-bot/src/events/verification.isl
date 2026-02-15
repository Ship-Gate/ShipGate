# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerVerificationEvents, sendVerificationNotification, sendVerificationSummary, VerificationEvent
# dependencies: 

domain Verification {
  version: "1.0.0"

  type VerificationEvent = String

  invariants exports_present {
    - true
  }
}
