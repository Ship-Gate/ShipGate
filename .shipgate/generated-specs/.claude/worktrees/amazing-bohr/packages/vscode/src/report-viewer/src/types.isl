# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createInitialState, calculateSummary, getHighestImpactFailure, filterClauses, SourceLocation, ClauseStatus, ClauseCategory, ImpactLevel, ClauseResult, ReportSummary, ReportMetadata, EvidenceReport, ReportViewerState, WebviewToExtensionMessage, ExtensionToWebviewMessage
# dependencies: 

domain Types {
  version: "1.0.0"

  type SourceLocation = String
  type ClauseStatus = String
  type ClauseCategory = String
  type ImpactLevel = String
  type ClauseResult = String
  type ReportSummary = String
  type ReportMetadata = String
  type EvidenceReport = String
  type ReportViewerState = String
  type WebviewToExtensionMessage = String
  type ExtensionToWebviewMessage = String

  invariants exports_present {
    - true
  }
}
