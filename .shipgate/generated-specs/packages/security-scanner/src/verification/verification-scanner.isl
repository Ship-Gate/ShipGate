# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runVerificationSecurityScan, VerificationSecurityScanner
# dependencies: fs/promises, path

domain VerificationScanner {
  version: "1.0.0"

  type VerificationSecurityScanner = String

  invariants exports_present {
    - true
  }
}
