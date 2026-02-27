# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ArtifactType, EvidenceArtifact, Assumption, OpenQuestion, ScoreSummary, VerificationMetadata, EvidenceClauseResult, EvidenceReport, ValidationResult, ValidationError
# dependencies: 

domain EvidenceTypes {
  version: "1.0.0"

  type ArtifactType = String
  type EvidenceArtifact = String
  type Assumption = String
  type OpenQuestion = String
  type ScoreSummary = String
  type VerificationMetadata = String
  type EvidenceClauseResult = String
  type EvidenceReport = String
  type ValidationResult = String
  type ValidationError = String

  invariants exports_present {
    - true
  }
}
