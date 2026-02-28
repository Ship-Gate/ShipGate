# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateReport, buildReportData, BuildReportDataOptions
# dependencies: fs/promises, path

domain GenerateReport {
  version: "1.0.0"

  type BuildReportDataOptions = String

  invariants exports_present {
    - true
  }
}
