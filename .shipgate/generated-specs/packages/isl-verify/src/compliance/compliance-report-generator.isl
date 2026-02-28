# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ComplianceFramework, ControlStatus, ComplianceControl, ComplianceEvidence, ComplianceReport, ExecutiveSummary, PropertyToControlMapping, ComplianceReportGenerator
# dependencies: 

domain ComplianceReportGenerator {
  version: "1.0.0"

  type ComplianceFramework = String
  type ControlStatus = String
  type ComplianceControl = String
  type ComplianceEvidence = String
  type ComplianceReport = String
  type ExecutiveSummary = String
  type PropertyToControlMapping = String
  type ComplianceReportGenerator = String

  invariants exports_present {
    - true
  }
}
