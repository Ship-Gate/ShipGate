# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: checkPolicyAgainstGate, checkPolicy, printPolicyCheckResult, getPolicyCheckExitCode, PolicyCheckOptions, PolicyCheckResult, PolicyViolation
# dependencies: path, chalk, minimatch

domain PolicyCheck {
  version: "1.0.0"

  type PolicyCheckOptions = String
  type PolicyCheckResult = String
  type PolicyViolation = String

  invariants exports_present {
    - true
  }
}
