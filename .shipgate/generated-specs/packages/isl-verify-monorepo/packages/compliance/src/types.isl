# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ComplianceFramework, ComplianceReport, ControlResult, ComplianceSummary
# dependencies: 

domain Types {
  version: "1.0.0"

  type ComplianceFramework = String
  type ComplianceReport = String
  type ControlResult = String
  type ComplianceSummary = String

  invariants exports_present {
    - true
  }
}
