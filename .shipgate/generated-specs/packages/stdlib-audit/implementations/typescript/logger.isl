# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAuditLogger, AuditLoggerOptions, AuditLogger
# dependencies: crypto

domain Logger {
  version: "1.0.0"

  type AuditLoggerOptions = String
  type AuditLogger = String

  invariants exports_present {
    - true
  }
}
