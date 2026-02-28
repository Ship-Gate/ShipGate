# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: redact, redactString, redactObject, mask, maskEmail, maskIp, safeError, createSafeLogger, safeLog, SafeLoggerConfig, LogEntry
# dependencies: 

domain SafeLogging {
  version: "1.0.0"

  type SafeLoggerConfig = String
  type LogEntry = String

  invariants exports_present {
    - true
  }
}
