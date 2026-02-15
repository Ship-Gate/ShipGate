# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISL_EVENTS, LOG_LEVEL_VALUES, LogLevel, Subsystem, EventCategory, EventName, ISLLogEvent, LogErrorDetails, LoggerOptions, ISLLogger
# dependencies: 

domain LogTypes {
  version: "1.0.0"

  type LogLevel = String
  type Subsystem = String
  type EventCategory = String
  type EventName = String
  type ISLLogEvent = String
  type LogErrorDetails = String
  type LoggerOptions = String
  type ISLLogger = String

  invariants exports_present {
    - true
  }
}
