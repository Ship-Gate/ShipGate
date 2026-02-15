# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verdictToSeverity, BLAST_RADIUS, SEVERITY_BY_CLAIM_TYPE, DEFAULT_SCORING_CONFIG, ClaimType, ClaimVerdict, ISLClaim, BlastRadius, BlastRadiusInfo, Severity, SeverityConfig, ScoredClaim, VerdictScoringResult, VerdictExplanation, ScoringConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClaimType = String
  type ClaimVerdict = String
  type ISLClaim = String
  type BlastRadius = String
  type BlastRadiusInfo = String
  type Severity = String
  type SeverityConfig = String
  type ScoredClaim = String
  type VerdictScoringResult = String
  type VerdictExplanation = String
  type ScoringConfig = String

  invariants exports_present {
    - true
  }
}
