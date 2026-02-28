# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: historyCommand, trendCommand, diffCommand, exportCommand, HistoryOptions, TrendOptions, DiffOptions, ExportOptions
# dependencies: @isl-lang/isl-verify, chalk

domain History {
  version: "1.0.0"

  type HistoryOptions = String
  type TrendOptions = String
  type DiffOptions = String
  type ExportOptions = String

  invariants exports_present {
    - true
  }
}
