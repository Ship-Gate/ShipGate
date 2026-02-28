# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLTracer
# dependencies: @opentelemetry/api, @opentelemetry/sdk-trace-node, @opentelemetry/sdk-trace-base, @opentelemetry/exporter-trace-otlp-http, @opentelemetry/exporter-jaeger, @opentelemetry/semantic-conventions, @opentelemetry/resources

domain Tracer {
  version: "1.0.0"

  type ISLTracer = String

  invariants exports_present {
    - true
  }
}
