# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFixedLatency, createVariableLatency, createJitteryLatency, createSpikeLatency, LatencyDistribution, LatencyInjectorConfig, LatencyInjectorState, LatencyInjector
# dependencies: 

domain Latency {
  version: "1.0.0"

  type LatencyDistribution = String
  type LatencyInjectorConfig = String
  type LatencyInjectorState = String
  type LatencyInjector = String

  invariants exports_present {
    - true
  }
}
