# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ObservabilityConfig, ExporterPreset, ExporterConfig, SpanExporterLike, SpanKind, SpanOptions, TracedSpan, OtelSpanStatusCode
# dependencies: 

domain Types {
  version: "1.0.0"

  type ObservabilityConfig = String
  type ExporterPreset = String
  type ExporterConfig = String
  type SpanExporterLike = String
  type SpanKind = String
  type SpanOptions = String
  type TracedSpan = String

  invariants exports_present {
    - true
  }
}
