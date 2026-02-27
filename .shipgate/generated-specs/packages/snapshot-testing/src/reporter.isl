# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateDiff, formatUnifiedDiff, formatInlineDiff, generateSnapshotReport, generateSummaryReport, ReporterOptions, DiffHunk, DiffLine, DiffResult
# dependencies: diff

domain Reporter {
  version: "1.0.0"

  type ReporterOptions = String
  type DiffHunk = String
  type DiffLine = String
  type DiffResult = String

  invariants exports_present {
    - true
  }
}
