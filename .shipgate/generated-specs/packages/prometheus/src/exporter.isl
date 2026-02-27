# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createExporter, PrometheusExporter
# dependencies: prom-client

domain Exporter {
  version: "1.0.0"

  type PrometheusExporter = String

  invariants exports_present {
    - true
  }
}
