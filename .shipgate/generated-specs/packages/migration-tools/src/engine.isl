# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: detectFormat, migrate, DetectedFormat, MigrationOptions, MigrationResult, MigrationStats, MigrationEngine
# dependencies: 

domain Engine {
  version: "1.0.0"

  type DetectedFormat = String
  type MigrationOptions = String
  type MigrationResult = String
  type MigrationStats = String
  type MigrationEngine = String

  invariants exports_present {
    - true
  }
}
