# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_VERIFY_RENDER_OPTIONS, ClauseVerdict, OverallVerdict, VerifyClauseType, TraceSliceRef, AdapterSnapshotRef, NoEvidenceRef, EvidenceRef, UnknownReason, SourceLocation, VerifyClauseResult, VerifySummary, VerifyResult, VerifyJsonOutput, VerifyRenderOptions
# dependencies: 

domain VerifyTypes {
  version: "1.0.0"

  type ClauseVerdict = String
  type OverallVerdict = String
  type VerifyClauseType = String
  type TraceSliceRef = String
  type AdapterSnapshotRef = String
  type NoEvidenceRef = String
  type EvidenceRef = String
  type UnknownReason = String
  type SourceLocation = String
  type VerifyClauseResult = String
  type VerifySummary = String
  type VerifyResult = String
  type VerifyJsonOutput = String
  type VerifyRenderOptions = String

  invariants exports_present {
    - true
  }
}
