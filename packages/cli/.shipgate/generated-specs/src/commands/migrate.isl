# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: migrate, printMigrateResult, getMigrateExitCode, MigrateOptions, MigrateResult
# dependencies: node:fs/promises, @isl-lang/parser, node:path

domain Migrate {
  version: "1.0.0"

  type MigrateOptions = String
  type MigrateResult = String

  invariants exports_present {
    - true
  }
}
