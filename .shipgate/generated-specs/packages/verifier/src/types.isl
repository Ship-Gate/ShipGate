# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClauseStatus, EvidenceKind, Evidence, ClauseResult, WorkspaceScanArtifacts, TestFileInfo, BindingInfo, AssertionInfo, ShipVerdict, ScoreBreakdown, EvidenceReport, ReportSummary, VerifyOptions, SpecAST, BehaviorSpec, ClauseSpec, InvariantSpec
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClauseStatus = String
  type EvidenceKind = String
  type Evidence = String
  type ClauseResult = String
  type WorkspaceScanArtifacts = String
  type TestFileInfo = String
  type BindingInfo = String
  type AssertionInfo = String
  type ShipVerdict = String
  type ScoreBreakdown = String
  type EvidenceReport = String
  type ReportSummary = String
  type VerifyOptions = String
  type SpecAST = String
  type BehaviorSpec = String
  type ClauseSpec = String
  type InvariantSpec = String

  invariants exports_present {
    - true
  }
}
