# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: compensatingAction, noCompensation, logCompensation, CompensationResult, CompensationError, CompensationOptions, CompensationRunner
# dependencies: 

domain Compensation {
  version: "1.0.0"

  type CompensationResult = String
  type CompensationError = String
  type CompensationOptions = String
  type CompensationRunner = String

  invariants exports_present {
    - true
  }
}
