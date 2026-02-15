# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSchemaSwitcher, generateSchemasMigration, generateSchemasRollback, createSchemaHook, SchemaConfig, ConnectionPoolConfig, SchemaInfo, SchemaManager, SchemaSwitcher, SchemaMigration
# dependencies: 

domain Schema {
  version: "1.0.0"

  type SchemaConfig = String
  type ConnectionPoolConfig = String
  type SchemaInfo = String
  type SchemaManager = String
  type SchemaSwitcher = String
  type SchemaMigration = String

  invariants exports_present {
    - true
  }
}
