# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatReport, formatDiagnostic, formatDuration, formatPercentage, formatReportJson, getVerdictColor, Diagnostic, ActionReport
# dependencies: 

domain Reporter {
  version: "1.0.0"

  type Diagnostic = String
  type ActionReport = String

  invariants exports_present {
    - true
  }
}
