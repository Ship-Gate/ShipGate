# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Verdict, ClauseStatus, SourceLocation, EvidenceItem, ClauseResult, Assumption, OpenQuestion, ReproCommand, VerificationSummary, VerificationMetadata, EvidenceReport
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type ClauseStatus = String
  type SourceLocation = String
  type EvidenceItem = String
  type ClauseResult = String
  type Assumption = String
  type OpenQuestion = String
  type ReproCommand = String
  type VerificationSummary = String
  type VerificationMetadata = String
  type EvidenceReport = String

  invariants exports_present {
    - true
  }
}
