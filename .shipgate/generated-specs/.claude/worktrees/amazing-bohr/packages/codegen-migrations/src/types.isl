# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DatabaseDialect, MigrationFormat, GenerateOptions, GeneratedFile, SchemaSnapshot, TableDefinition, ColumnDefinition, ForeignKeyReference, IndexDefinition, ConstraintDefinition, EnumDefinition, MigrationChange
# dependencies: 

domain Types {
  version: "1.0.0"

  type DatabaseDialect = String
  type MigrationFormat = String
  type GenerateOptions = String
  type GeneratedFile = String
  type SchemaSnapshot = String
  type TableDefinition = String
  type ColumnDefinition = String
  type ForeignKeyReference = String
  type IndexDefinition = String
  type ConstraintDefinition = String
  type EnumDefinition = String
  type MigrationChange = String

  invariants exports_present {
    - true
  }
}
