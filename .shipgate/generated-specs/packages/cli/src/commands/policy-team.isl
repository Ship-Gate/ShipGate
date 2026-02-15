# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: policyCheck, policyInit, printPolicyCheckResult, printPolicyInitResult, getPolicyCheckExitCode, PolicyCheckOptions, PolicyCheckResult, PolicyInitOptions, PolicyInitResult
# dependencies: fs/promises, fs, path, chalk, @isl-lang/core

domain PolicyTeam {
  version: "1.0.0"

  type PolicyCheckOptions = String
  type PolicyCheckResult = String
  type PolicyInitOptions = String
  type PolicyInitResult = String

  invariants exports_present {
    - true
  }
}
