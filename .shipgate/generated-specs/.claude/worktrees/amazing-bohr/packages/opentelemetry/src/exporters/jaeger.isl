# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createJaegerExporter, createJaegerProcessor, configureJaegerProvider, jaegerConfigFromEnv, defaultJaegerConfig, ISLJaegerConfig
# dependencies: @opentelemetry/exporter-jaeger, @opentelemetry/sdk-trace-node, @opentelemetry/sdk-trace-base

domain Jaeger {
  version: "1.0.0"

  type ISLJaegerConfig = String

  invariants exports_present {
    - true
  }
}
