# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: checkEnvVars, checkSingleEnvVar, summarizeEnvResults, EnvCheckOptions
# dependencies: 

domain EnvChecker {
  version: "1.0.0"

  type EnvCheckOptions = String

  invariants exports_present {
    - true
  }
}
