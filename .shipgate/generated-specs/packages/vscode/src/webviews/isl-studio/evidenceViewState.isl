# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createInitialState, calculateSummary, VerificationStatus, VerificationResult, Assumption, OpenQuestion, FileReference, ReportMetadata, ScoreBreakdown, EvidenceViewState, WebviewMessage, ExtensionMessage
# dependencies: 

domain EvidenceViewState {
  version: "1.0.0"

  type VerificationStatus = String
  type VerificationResult = String
  type Assumption = String
  type OpenQuestion = String
  type FileReference = String
  type ReportMetadata = String
  type ScoreBreakdown = String
  type EvidenceViewState = String
  type WebviewMessage = String
  type ExtensionMessage = String

  invariants exports_present {
    - true
  }
}
