# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createLoggingMiddleware, createCustomLoggingMiddleware, createJsonLoggingMiddleware, DefaultLogger, LogFormatters, LoggingOptions, LogEntry, LogFormatter, LoggingMiddleware, StructuredLogger
# dependencies: 

domain Logging {
  version: "1.0.0"

  type LoggingOptions = String
  type LogEntry = String
  type LogFormatter = String
  type LoggingMiddleware = String
  type StructuredLogger = String

  invariants exports_present {
    - true
  }
}
