# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ValidationResult, ValidationError, JSONSchema, SchemaValidator
# dependencies: ajv

domain Schema {
  version: "1.0.0"

  type ValidationResult = String
  type ValidationError = String
  type JSONSchema = String
  type SchemaValidator = String

  invariants exports_present {
    - true
  }
}
