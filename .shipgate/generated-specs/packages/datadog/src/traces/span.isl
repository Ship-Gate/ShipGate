# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createISLTracer, Traced, ISLSpanAttributes, SpanBuilder, ISLTracer
# dependencies: 

domain Span {
  version: "1.0.0"

  type ISLSpanAttributes = String
  type SpanBuilder = String
  type ISLTracer = String

  invariants exports_present {
    - true
  }
}
