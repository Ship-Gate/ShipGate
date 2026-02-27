# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: securityReport, printSecurityReportResult, getSecurityReportExitCode, SecurityReportOptions, SecurityReportResult
# dependencies: path, chalk, ora, @isl-lang/security-scanner

domain SecurityReport {
  version: "1.0.0"

  type SecurityReportOptions = String
  type SecurityReportResult = String

  invariants exports_present {
    - true
  }
}
