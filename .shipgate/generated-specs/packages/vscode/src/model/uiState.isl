# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildSidebarState, buildReportState, VerdictType, FindingRow, PrRow, RunRow, SidebarUiState, ReportUiState, SidebarInput
# dependencies: 

domain UiState {
  version: "1.0.0"

  type VerdictType = String
  type FindingRow = String
  type PrRow = String
  type RunRow = String
  type SidebarUiState = String
  type ReportUiState = String
  type SidebarInput = String

  invariants exports_present {
    - true
  }
}
