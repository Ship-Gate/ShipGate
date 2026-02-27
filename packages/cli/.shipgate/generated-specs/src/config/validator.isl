# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateConfig, formatValidationErrors, ValidationError, ValidationResult
# dependencies: 

domain Validator {
  version: "1.0.0"

  type ValidationError = String
  type ValidationResult = String

  invariants exports_present {
    - true
  }
}
