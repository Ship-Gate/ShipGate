# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: migrateV1ToV2, MigrationOptions, MigrationResult
# dependencies: fs/promises, path

domain Migrate {
  version: "1.0.0"

  type MigrationOptions = String
  type MigrationResult = String

  invariants exports_present {
    - true
  }
}
