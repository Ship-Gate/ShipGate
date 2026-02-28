# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getAuditRequestContext, audit, auditLog, AuditRequestContext
# dependencies: next/server, crypto, @/lib/prisma, @prisma/client

domain Audit {
  version: "1.0.0"

  type AuditRequestContext = String

  invariants exports_present {
    - true
  }
}
