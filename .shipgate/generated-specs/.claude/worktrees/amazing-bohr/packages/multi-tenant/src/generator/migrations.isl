# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatMigration, getMigrationFilename, MigrationConfig, Migration, TableSchema, ColumnSchema, IndexSchema, ForeignKeySchema, MigrationGenerator
# dependencies: 

domain Migrations {
  version: "1.0.0"

  type MigrationConfig = String
  type Migration = String
  type TableSchema = String
  type ColumnSchema = String
  type IndexSchema = String
  type ForeignKeySchema = String
  type MigrationGenerator = String

  invariants exports_present {
    - true
  }
}
