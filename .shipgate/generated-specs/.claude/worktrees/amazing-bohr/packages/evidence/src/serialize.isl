# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: serialize, deserialize, computeHash, areEqual, diff, stripTimestamps, SerializeOptions, ReportDiff, ClauseChange
# dependencies: 

domain Serialize {
  version: "1.0.0"

  type SerializeOptions = String
  type ReportDiff = String
  type ClauseChange = String

  invariants exports_present {
    - true
  }
}
