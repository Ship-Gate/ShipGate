# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_AUDIT_OPTIONS, RiskLevel, CoverageStatus, ImplementationType, DetectedImplementation, DetectedPattern, ISLBehavior, BehaviorMapping, RiskyZone, AuditSummary, AuditReport, AuditOptions
# dependencies: 

domain AuditTypes {
  version: "1.0.0"

  type RiskLevel = String
  type CoverageStatus = String
  type ImplementationType = String
  type DetectedImplementation = String
  type DetectedPattern = String
  type ISLBehavior = String
  type BehaviorMapping = String
  type RiskyZone = String
  type AuditSummary = String
  type AuditReport = String
  type AuditOptions = String

  invariants exports_present {
    - true
  }
}
