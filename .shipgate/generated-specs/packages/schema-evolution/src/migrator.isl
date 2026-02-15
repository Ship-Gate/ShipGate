# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createVersionHistory, SchemaMigrator
# dependencies: semver

domain Migrator {
  version: "1.0.0"

  type SchemaMigrator = String

  invariants exports_present {
    - true
  }
}
