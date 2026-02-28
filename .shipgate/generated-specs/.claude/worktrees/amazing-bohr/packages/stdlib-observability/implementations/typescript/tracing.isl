# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: injectContext, extractContext, getDefaultTracer, setDefaultTracer, B3_PARENT_SPAN_ID_HEADER, ConsoleSpanExporter, InMemorySpanExporter, TracerConfig, Tracer, SpanKind, SpanStatus, PropagationFormat
# dependencies: 

domain Tracing {
  version: "1.0.0"

  type ConsoleSpanExporter = String
  type InMemorySpanExporter = String
  type TracerConfig = String
  type Tracer = String

  invariants exports_present {
    - true
  }
}
