# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: up, down, generateMigrations, MigrationOptions, SchemaDiff, MigrationGenerator
# dependencies: knex

domain Generator {
  version: "1.0.0"

  type MigrationOptions = String
  type SchemaDiff = String
  type MigrationGenerator = String

  invariants exports_present {
    - true
  }
}
