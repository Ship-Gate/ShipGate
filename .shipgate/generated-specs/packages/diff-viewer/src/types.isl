# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DiffViewMode, ChangeType, BreakingChangeLevel, LineDiff, HunkDiff, FileDiff, SemanticChange, SemanticChangeType, MigrationHint, MigrationStep, DiffSummary, DiffViewerState, DiffViewerProps
# dependencies: 

domain Types {
  version: "1.0.0"

  type DiffViewMode = String
  type ChangeType = String
  type BreakingChangeLevel = String
  type LineDiff = String
  type HunkDiff = String
  type FileDiff = String
  type SemanticChange = String
  type SemanticChangeType = String
  type MigrationHint = String
  type MigrationStep = String
  type DiffSummary = String
  type DiffViewerState = String
  type DiffViewerProps = String

  invariants exports_present {
    - true
  }
}
