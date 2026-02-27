# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TELEMETRY_EVENTS, DEFAULT_REDACTION_PATTERNS, TELEMETRY_ENV_VAR, TELEMETRY_DIR_ENV_VAR, TelemetryEvent, TelemetryMetadata, TelemetryConfig, RedactionPattern, TelemetryRecorder, TelemetryEventName
# dependencies: 

domain TelemetryTypes {
  version: "1.0.0"

  type TelemetryEvent = String
  type TelemetryMetadata = String
  type TelemetryConfig = String
  type RedactionPattern = String
  type TelemetryRecorder = String
  type TelemetryEventName = String

  invariants exports_present {
    - true
  }
}
