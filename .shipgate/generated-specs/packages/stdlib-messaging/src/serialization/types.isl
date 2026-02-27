# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SerializerRegistry, SchemaRegistry, ValidationResult, ValidationError, CompatibilityResult, CompatibilityIssue, SchemaStore, SchemaInfo, EncodingOptions, DecodingOptions, SchemaMigration, SchemaMigrator
# dependencies: 

domain Types {
  version: "1.0.0"

  type SerializerRegistry = String
  type SchemaRegistry = String
  type ValidationResult = String
  type ValidationError = String
  type CompatibilityResult = String
  type CompatibilityIssue = String
  type SchemaStore = String
  type SchemaInfo = String
  type EncodingOptions = String
  type DecodingOptions = String
  type SchemaMigration = String
  type SchemaMigrator = String

  invariants exports_present {
    - true
  }
}
