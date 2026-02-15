# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: chaos, printChaosResult, getChaosExitCode, ChaosOptions, ChaosResult, ChaosVerifyResult, ChaosTestResult, ChaosCoverageReport, CoverageMetric, ChaosTimingReport
# dependencies: fs/promises, fs, path, chalk, ora, @isl-lang/parser, @isl-lang/import-resolver

domain Chaos {
  version: "1.0.0"

  type ChaosOptions = String
  type ChaosResult = String
  type ChaosVerifyResult = String
  type ChaosTestResult = String
  type ChaosCoverageReport = String
  type CoverageMetric = String
  type ChaosTimingReport = String

  invariants exports_present {
    - true
  }
}
