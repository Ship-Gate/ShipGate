# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EnvDefinition, EnvUsage, MismatchType, RemediationAction, EnvRealityClaim, EnvRealityResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type EnvDefinition = String
  type EnvUsage = String
  type MismatchType = String
  type RemediationAction = String
  type EnvRealityClaim = String
  type EnvRealityResult = String

  invariants exports_present {
    - true
  }
}
