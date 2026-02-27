# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ComplianceRule, RuleSeverity, RuleResult, ComplianceReport, ReportSummary
# dependencies: 

domain Types {
  version: "1.0.0"

  type ComplianceRule = String
  type RuleSeverity = String
  type RuleResult = String
  type ComplianceReport = String
  type ReportSummary = String

  invariants exports_present {
    - true
  }
}
