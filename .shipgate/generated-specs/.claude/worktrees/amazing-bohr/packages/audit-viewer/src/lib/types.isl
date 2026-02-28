# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Verdict, CheckType, Actor, Check, AuditEvent, DateRange, AuditFilters, PaginatedResult, ComplianceFramework, ControlStatus, ComplianceControl, ComplianceEvidence, ComplianceReport, ComplianceSummary, AuditStatistics, ExportFormat, ExportOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type CheckType = String
  type Actor = String
  type Check = String
  type AuditEvent = String
  type DateRange = String
  type AuditFilters = String
  type PaginatedResult = String
  type ComplianceFramework = String
  type ControlStatus = String
  type ComplianceControl = String
  type ComplianceEvidence = String
  type ComplianceReport = String
  type ComplianceSummary = String
  type AuditStatistics = String
  type ExportFormat = String
  type ExportOptions = String

  invariants exports_present {
    - true
  }
}
