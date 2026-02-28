# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isAssumptionViolationError, AssumptionViolationCode, AssumptionViolationCodeType, AssumptionViolationContext, AssumptionViolationError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type AssumptionViolationCodeType = String
  type AssumptionViolationContext = String
  type AssumptionViolationError = String

  invariants exports_present {
    - true
  }
}
