# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: redactSecrets, createTelemetry, createLocalTelemetry, createNullTelemetry, MemoryTelemetryRecorder, TELEMETRY_EVENTS, DEFAULT_REDACTION_PATTERNS, TELEMETRY_ENV_VAR, TELEMETRY_DIR_ENV_VAR
# dependencies: @isl/core/telemetry

domain Telemetry {
  version: "1.0.0"

  type MemoryTelemetryRecorder = String

  invariants exports_present {
    - true
  }
}
