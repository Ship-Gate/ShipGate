# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: InMemorySchemaStore, JsonSchemaValidator, DefaultSchemaRegistry, DefaultSchemaMigrator
# dependencies: 

domain Schema {
  version: "1.0.0"

  type InMemorySchemaStore = String
  type JsonSchemaValidator = String
  type DefaultSchemaRegistry = String
  type DefaultSchemaMigrator = String

  invariants exports_present {
    - true
  }
}
