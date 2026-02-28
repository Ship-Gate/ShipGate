# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createZipkinExporter, createZipkinProcessor, configureZipkinProvider, zipkinConfigFromEnv, defaultZipkinConfig, ZipkinURLs, ISLZipkinConfig
# dependencies: @opentelemetry/exporter-zipkin, @opentelemetry/sdk-trace-node, @opentelemetry/sdk-trace-base

domain Zipkin {
  version: "1.0.0"

  type ISLZipkinConfig = String

  invariants exports_present {
    - true
  }
}
