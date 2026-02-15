# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: quickValidate, formatValidationResult, ValidationResult, ValidationError, ValidatorOptions, FixValidator
# dependencies: typescript

domain Validator {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationError = String
  type ValidatorOptions = String
  type FixValidator = String

  invariants exports_present {
    - true
  }
}
