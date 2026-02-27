# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: specQuality, printSpecQualityResult, getSpecQualityExitCode, SpecQualityCommandOptions, SpecQualityCommandResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser

domain SpecQuality {
  version: "1.0.0"

  type SpecQualityCommandOptions = String
  type SpecQualityCommandResult = String

  invariants exports_present {
    - true
  }
}
