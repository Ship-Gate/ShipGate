# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateRequest, ValidationResult, ValidationViolation, ValidationError, RequestValidator
# dependencies: 

domain Validator {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationViolation = String
  type ValidationError = String
  type RequestValidator = String

  invariants exports_present {
    - true
  }
}
