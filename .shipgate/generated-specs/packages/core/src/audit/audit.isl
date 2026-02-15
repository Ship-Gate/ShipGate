# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: auditWorkspace, formatAuditReportForStudio, getAuditSummaryText, AuditWorkspaceOptions
# dependencies: fs/promises, path, crypto

domain Audit {
  version: "1.0.0"

  type AuditWorkspaceOptions = String

  invariants exports_present {
    - true
  }
}
