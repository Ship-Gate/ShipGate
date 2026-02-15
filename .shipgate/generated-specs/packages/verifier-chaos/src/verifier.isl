# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, createVerifier, VerifyResult, ChaosTestResult, ChaosTestError, ChaosCoverageReport, CoverageMetric, ChaosTimingReport, VerifyOptions, ImplementationAdapter, ChaosVerifier
# dependencies: 

domain Verifier {
  version: "1.0.0"

  type VerifyResult = String
  type ChaosTestResult = String
  type ChaosTestError = String
  type ChaosCoverageReport = String
  type CoverageMetric = String
  type ChaosTimingReport = String
  type VerifyOptions = String
  type ImplementationAdapter = String
  type ChaosVerifier = String

  invariants exports_present {
    - true
  }
}
