# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseTscErrors, groupErrorsByFile, runTscCheck, runFixPass, TscError, CodeQualityGateResult, FixPassOptions, CodeQualityGate
# dependencies: child_process, fs/promises, path

domain CodeQualityGate {
  version: "1.0.0"

  type TscError = String
  type CodeQualityGateResult = String
  type FixPassOptions = String
  type CodeQualityGate = String

  invariants exports_present {
    - true
  }
}
