# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: VerificationMetrics
# dependencies: prom-client

domain Verification {
  version: "1.0.0"

  type VerificationMetrics = String

  invariants exports_present {
    - true
  }
}
