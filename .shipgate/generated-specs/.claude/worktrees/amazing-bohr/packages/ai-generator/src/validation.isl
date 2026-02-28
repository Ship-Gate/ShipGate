# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateCode, quickValidate, formatValidationResult, ValidationResult, ValidationError, ValidationWarning, CodeMetrics, ValidationOptions
# dependencies: typescript

domain Validation {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationError = String
  type ValidationWarning = String
  type CodeMetrics = String
  type ValidationOptions = String

  invariants exports_present {
    - true
  }
}
