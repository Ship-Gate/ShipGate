# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BundleHistoryRecord, FindingHistoryRecord, TrendData, BundleDiff, BundleHistoryOptions, BundleHistory
# dependencies: 

domain BundleHistory {
  version: "1.0.0"

  type BundleHistoryRecord = String
  type FindingHistoryRecord = String
  type TrendData = String
  type BundleDiff = String
  type BundleHistoryOptions = String
  type BundleHistory = String

  invariants exports_present {
    - true
  }
}
