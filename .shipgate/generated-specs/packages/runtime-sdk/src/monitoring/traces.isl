# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createOpenTelemetryTracer, TracerOptions, Tracer, Span, SpanContext, ISLTracer, VerificationSpan
# dependencies: 

domain Traces {
  version: "1.0.0"

  type TracerOptions = String
  type Tracer = String
  type Span = String
  type SpanContext = String
  type ISLTracer = String
  type VerificationSpan = String

  invariants exports_present {
    - true
  }
}
