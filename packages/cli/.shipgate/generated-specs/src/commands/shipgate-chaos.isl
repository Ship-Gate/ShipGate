# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: shipgateChaosRun, printShipGateChaosResult, getShipGateChaosExitCode, ShipGateChaosOptions, ShipGateChaosResult, ViolationClaim, ReproductionStep, ChaosVerifyResult, ChaosTestResult, ChaosCoverageReport, CoverageMetric, ChaosTimingReport
# dependencies: fs/promises, fs, path, chalk, ora, @isl-lang/parser, @isl-lang/import-resolver

domain ShipgateChaos {
  version: "1.0.0"

  type ShipGateChaosOptions = String
  type ShipGateChaosResult = String
  type ViolationClaim = String
  type ReproductionStep = String
  type ChaosVerifyResult = String
  type ChaosTestResult = String
  type ChaosCoverageReport = String
  type CoverageMetric = String
  type ChaosTimingReport = String

  invariants exports_present {
    - true
  }
}
