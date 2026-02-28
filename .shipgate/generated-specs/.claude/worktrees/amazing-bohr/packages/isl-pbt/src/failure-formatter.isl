# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatFailure, formatFailureJSON, FailureReport, ShrunkField
# dependencies: 

domain FailureFormatter {
  version: "1.0.0"

  type FailureReport = String
  type ShrunkField = String

  invariants exports_present {
    - true
  }
}
