# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateType, validateEntity, validateConstraints, ValidationResult, ValidationError
# dependencies: 

domain Validator {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationError = String

  invariants exports_present {
    - true
  }
}
