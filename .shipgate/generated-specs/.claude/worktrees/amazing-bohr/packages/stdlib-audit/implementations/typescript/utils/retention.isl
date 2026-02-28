# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateCompliance, DEFAULT_RETENTION_POLICIES, RetentionManagerOptions, Archiver, RetentionManager, RetentionRunResult, ComplianceValidationResult, ComplianceIssue
# dependencies: 

domain Retention {
  version: "1.0.0"

  type RetentionManagerOptions = String
  type Archiver = String
  type RetentionManager = String
  type RetentionRunResult = String
  type ComplianceValidationResult = String
  type ComplianceIssue = String

  invariants exports_present {
    - true
  }
}
