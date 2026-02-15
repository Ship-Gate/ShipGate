# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SecuritySeverity, SecurityFinding, SecurityCheckResult, VerificationSecurityScanOptions, VerificationSecurityScanResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type SecuritySeverity = String
  type SecurityFinding = String
  type SecurityCheckResult = String
  type VerificationSecurityScanOptions = String
  type VerificationSecurityScanResult = String

  invariants exports_present {
    - true
  }
}
