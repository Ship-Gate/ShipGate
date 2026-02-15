# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ViolationType, Violation, RuntimeChecker
# dependencies: 

domain Verification {
  version: "1.0.0"

  type ViolationType = String
  type Violation = String
  type RuntimeChecker = String

  invariants exports_present {
    - true
  }
}
