# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateStateMachine, ValidationResult, ValidationError, ValidationWarning, StateValidator
# dependencies: 

domain Validator {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationError = String
  type ValidationWarning = String
  type StateValidator = String

  invariants exports_present {
    - true
  }
}
