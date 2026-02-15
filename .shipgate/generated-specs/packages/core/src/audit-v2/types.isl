# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_AUDIT_OPTIONS_V2, RiskSeverity, BehaviorCategory, FrameworkHint, DetectedCandidate, RiskFlag, BehaviorMapping, AuditSummaryV2, AuditReportV2, AuditOptionsV2, DetectorResult, Detector
# dependencies: 

domain Types {
  version: "1.0.0"

  type RiskSeverity = String
  type BehaviorCategory = String
  type FrameworkHint = String
  type DetectedCandidate = String
  type RiskFlag = String
  type BehaviorMapping = String
  type AuditSummaryV2 = String
  type AuditReportV2 = String
  type AuditOptionsV2 = String
  type DetectorResult = String
  type Detector = String

  invariants exports_present {
    - true
  }
}
