# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createOTLPTraceExporter, createOTLPProcessor, createOTLPMetricExporter, createOTLPMetricReader, configureOTLPProvider, configureOTLPMeterProvider, otlpConfigFromEnv, defaultOTLPConfig, OTLPBackends, OTLPProtocol, ISLOTLPConfig
# dependencies: @opentelemetry/exporter-trace-otlp-http, @opentelemetry/exporter-trace-otlp-grpc, @opentelemetry/exporter-metrics-otlp-http, @opentelemetry/sdk-trace-node, @opentelemetry/sdk-trace-base, @opentelemetry/sdk-metrics

domain Otlp {
  version: "1.0.0"

  type OTLPProtocol = String
  type ISLOTLPConfig = String

  invariants exports_present {
    - true
  }
}
