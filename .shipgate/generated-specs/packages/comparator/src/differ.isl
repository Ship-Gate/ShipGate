# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: diff, generateOutputDiff, generateMultiDiff, formatChange, formatDiff, DiffChange, OutputDiff, DiffSummary, DiffOptions, MultiDiff, AggregatedDiff, SimilarityGroup
# dependencies: 

domain Differ {
  version: "1.0.0"

  type DiffChange = String
  type OutputDiff = String
  type DiffSummary = String
  type DiffOptions = String
  type MultiDiff = String
  type AggregatedDiff = String
  type SimilarityGroup = String

  invariants exports_present {
    - true
  }
}
