# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: setLogContext, clearLogContext, getLogContext, logLevelToString, parseLogLevel, getDefaultLogger, setDefaultLogger, ConsoleLogExporter, InMemoryLogExporter, Logger, LogLevel
# dependencies: 

domain Logging {
  version: "1.0.0"

  type ConsoleLogExporter = String
  type InMemoryLogExporter = String
  type Logger = String

  invariants exports_present {
    - true
  }
}
