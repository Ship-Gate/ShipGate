# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: policyEngineCheck, printPolicyEngineResult, getPolicyEngineExitCode, PolicyEngineCheckOptions, PolicyEngineCheckResult
# dependencies: fs/promises, path, chalk, @isl-lang/isl-policy-engine

domain PolicyEngine {
  version: "1.0.0"

  type PolicyEngineCheckOptions = String
  type PolicyEngineCheckResult = String

  invariants exports_present {
    - true
  }
}
