# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildReport, buildProofArtifact, writeReportToDir, formatHumanSummary, formatCliSummary, BuildReportInput
# dependencies: fs, path

domain ReportGenerator {
  version: "1.0.0"

  type BuildReportInput = String

  invariants exports_present {
    - true
  }
}
