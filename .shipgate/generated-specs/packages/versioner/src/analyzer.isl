# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeChanges, ChangeType, Change, ChangeAnalysis
# dependencies: 

domain Analyzer {
  version: "1.0.0"

  type ChangeType = String
  type Change = String
  type ChangeAnalysis = String

  invariants exports_present {
    - true
  }
}
