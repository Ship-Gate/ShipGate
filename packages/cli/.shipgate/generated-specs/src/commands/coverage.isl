# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: coverage, printCoverageResult, getCoverageExitCode, CoverageCommandOptions, CoverageCommandResult
# dependencies: @isl-lang/isl-coverage, node:path, node:fs, glob, chalk

domain Coverage {
  version: "1.0.0"

  type CoverageCommandOptions = String
  type CoverageCommandResult = String

  invariants exports_present {
    - true
  }
}
