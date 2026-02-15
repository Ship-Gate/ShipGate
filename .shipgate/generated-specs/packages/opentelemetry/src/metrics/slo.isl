# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSLOMetrics, SLOTemplates, SLODefinition, SLOMeasurement, SLOStatus, SLOMetrics
# dependencies: @opentelemetry/sdk-metrics, @opentelemetry/api

domain Slo {
  version: "1.0.0"

  type SLODefinition = String
  type SLOMeasurement = String
  type SLOStatus = String
  type SLOMetrics = String

  invariants exports_present {
    - true
  }
}
