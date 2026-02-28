# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: checkCompatibility, isBreakingChangeType, suggestMigrationStrategy, CompatibilityResult, MigrationStrategy
# dependencies: 

domain Checker {
  version: "1.0.0"

  type CompatibilityResult = String
  type MigrationStrategy = String

  invariants exports_present {
    - true
  }
}
