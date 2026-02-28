# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getTelemetry, SpanContext, Span
# dependencies: 

domain Telemetry {
  version: "1.0.0"

  type SpanContext = String
  type Span = String

  invariants exports_present {
    - true
  }
}
