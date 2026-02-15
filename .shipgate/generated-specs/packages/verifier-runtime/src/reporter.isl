# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateReport, generateSummaryReport, ReportFormat, ReportOptions
# dependencies: 

domain Reporter {
  version: "1.0.0"

  type ReportFormat = String
  type ReportOptions = String

  invariants exports_present {
    - true
  }
}
