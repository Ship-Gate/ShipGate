# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: auditWorkspaceV2, formatAuditReportV2, getAuditSummaryTextV2, AuditWorkspaceOptionsV2
# dependencies: fs/promises, path, crypto

domain Audit {
  version: "1.0.0"

  type AuditWorkspaceOptionsV2 = String

  invariants exports_present {
    - true
  }
}
