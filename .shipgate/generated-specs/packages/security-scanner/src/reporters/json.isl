# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateJsonReport, generateJsonString, generateMinimalJson, JsonReport, JsonReportMetadata, JsonReportSummary, JsonFinding, JsonStatistics, JsonReportOptions
# dependencies: 

domain Json {
  version: "1.0.0"

  type JsonReport = String
  type JsonReportMetadata = String
  type JsonReportSummary = String
  type JsonFinding = String
  type JsonStatistics = String
  type JsonReportOptions = String

  invariants exports_present {
    - true
  }
}
