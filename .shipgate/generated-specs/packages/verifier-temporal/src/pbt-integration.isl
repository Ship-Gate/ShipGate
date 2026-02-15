# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runTemporalPBT, createRandomTraceGenerator, formatPBTReport, DEFAULT_CONFIG, alwaysProperty, eventuallyProperty, neverProperty, withinProperty, leadsToProperty, TemporalProperty, TemporalPBTConfig, TemporalPBTResult, TemporalPBTFailure, TraceGenerator
# dependencies: 

domain PbtIntegration {
  version: "1.0.0"

  type TemporalProperty = String
  type TemporalPBTConfig = String
  type TemporalPBTResult = String
  type TemporalPBTFailure = String
  type TraceGenerator = String

  invariants exports_present {
    - true
  }
}
