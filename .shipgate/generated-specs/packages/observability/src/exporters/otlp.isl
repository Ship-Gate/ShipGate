# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createOTLPExporter, OTLPExporterOptions
# dependencies: @isl-lang/observability, @isl-lang/observability/exporters/otlp, @opentelemetry/exporter-trace-otlp-http

domain Otlp {
  version: "1.0.0"

  type OTLPExporterOptions = String

  invariants exports_present {
    - true
  }
}
