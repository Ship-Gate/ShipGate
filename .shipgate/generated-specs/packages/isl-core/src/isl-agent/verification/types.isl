# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClauseStatus, EvidenceType, BindingEntry, ParsedBindings, VerificationNote, ClauseResult, HeuristicMatch, VerificationResult, VerifyOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClauseStatus = String
  type EvidenceType = String
  type BindingEntry = String
  type ParsedBindings = String
  type VerificationNote = String
  type ClauseResult = String
  type HeuristicMatch = String
  type VerificationResult = String
  type VerifyOptions = String

  invariants exports_present {
    - true
  }
}
