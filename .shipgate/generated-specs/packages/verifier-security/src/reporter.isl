# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateReport, toInvariantClauseResults, formatInvariantClause, ReportFormat, ReportOptions, InvariantClauseResult
# dependencies: 

domain Reporter {
  version: "1.0.0"

  type ReportFormat = String
  type ReportOptions = String
  type InvariantClauseResult = String

  invariants exports_present {
    - true
  }
}
