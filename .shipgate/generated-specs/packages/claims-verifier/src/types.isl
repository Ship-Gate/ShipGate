# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClaimSource, CommandOutputSource, RepoMetadataSource, UserProvidedSource, ComputedSource, VerificationMethod, VerificationStatus, Claim, ClaimLocation, KnownFact, RefreshMethod, LintResult, LintIssue, ClaimPattern, VerifierConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClaimSource = String
  type CommandOutputSource = String
  type RepoMetadataSource = String
  type UserProvidedSource = String
  type ComputedSource = String
  type VerificationMethod = String
  type VerificationStatus = String
  type Claim = String
  type ClaimLocation = String
  type KnownFact = String
  type RefreshMethod = String
  type LintResult = String
  type LintIssue = String
  type ClaimPattern = String
  type VerifierConfig = String

  invariants exports_present {
    - true
  }
}
