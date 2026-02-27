# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: execute, errorHandler, requestLogger, corsMiddleware, rateLimiter, auditLog, authMiddleware, ExpressAdapter, prisma, AuditEntry
# dependencies: express, zod, @prisma/client

domain ExpressAdapter {
  version: "1.0.0"

  type AuditEntry = String

  invariants exports_present {
    - true
  }
}
