# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PolicySeverity, BannedPattern, SecurityPolicy, SpecTemplate, TeamPolicies, TeamConfig, ResolvedConfig, PolicyViolation, PolicyResult, CoverageInfo, PolicyVerifyInput, TeamConfigValidationError, TeamConfigValidationResult, LoadTeamConfigResult
# dependencies: 

domain TeamConfigTypes {
  version: "1.0.0"

  type PolicySeverity = String
  type BannedPattern = String
  type SecurityPolicy = String
  type SpecTemplate = String
  type TeamPolicies = String
  type TeamConfig = String
  type ResolvedConfig = String
  type PolicyViolation = String
  type PolicyResult = String
  type CoverageInfo = String
  type PolicyVerifyInput = String
  type TeamConfigValidationError = String
  type TeamConfigValidationResult = String
  type LoadTeamConfigResult = String

  invariants exports_present {
    - true
  }
}
