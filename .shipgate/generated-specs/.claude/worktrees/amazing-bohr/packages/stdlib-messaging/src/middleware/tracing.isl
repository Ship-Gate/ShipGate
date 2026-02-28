# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTracingMiddleware, createCustomTracingMiddleware, createOpenTelemetryTracingMiddleware, Tracer, Span, SpanContext, SpanOptions, DefaultTracer, DefaultSpan, TracingOptions, TracingMiddleware, OpenTelemetryTracerAdapter, OpenTelemetrySpanAdapter
# dependencies: 

domain Tracing {
  version: "1.0.0"

  type Tracer = String
  type Span = String
  type SpanContext = String
  type SpanOptions = String
  type DefaultTracer = String
  type DefaultSpan = String
  type TracingOptions = String
  type TracingMiddleware = String
  type OpenTelemetryTracerAdapter = String
  type OpenTelemetrySpanAdapter = String

  invariants exports_present {
    - true
  }
}
