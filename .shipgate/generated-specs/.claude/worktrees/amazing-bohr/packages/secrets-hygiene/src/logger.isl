# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSafeLogger, safeLogger, SafeLoggerOptions, SafeLogger
# dependencies: 

domain Logger {
  version: "1.0.0"

  type SafeLoggerOptions = String
  type SafeLogger = String

  invariants exports_present {
    - true
  }
}
