# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ValidationResult, ResponseValidator
# dependencies: 

domain ResponseValidator {
  version: "1.0.0"

  type ValidationResult = String
  type ResponseValidator = String

  invariants exports_present {
    - true
  }
}
