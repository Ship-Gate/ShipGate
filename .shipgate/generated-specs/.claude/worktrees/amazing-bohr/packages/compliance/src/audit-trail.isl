# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AuditTrail, AuditSummary, AuditControl, AuditEvidence, AuditChange, AuditAttestation, AuditTrailGenerator
# dependencies: crypto

domain AuditTrail {
  version: "1.0.0"

  type AuditTrail = String
  type AuditSummary = String
  type AuditControl = String
  type AuditEvidence = String
  type AuditChange = String
  type AuditAttestation = String
  type AuditTrailGenerator = String

  invariants exports_present {
    - true
  }
}
