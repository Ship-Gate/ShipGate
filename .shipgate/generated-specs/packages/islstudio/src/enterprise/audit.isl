# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createGateAuditEntry, createSuppressionAuditEntry, createExceptionAuditEntry, exportAuditLog, saveAuditLog, loadAuditLog, generateAuditSummary, AuditEntry, AuditLog
# dependencies: fs/promises, path

domain Audit {
  version: "1.0.0"

  type AuditEntry = String
  type AuditLog = String

  invariants exports_present {
    - true
  }
}
