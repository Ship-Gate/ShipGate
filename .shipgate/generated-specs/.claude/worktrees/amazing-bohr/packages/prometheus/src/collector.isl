# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCollector, createBatchCollector, VerifierResult, ChaosVerifierResult, CollectorCallback, ChaosCollectorCallback, CollectorConfig, MetricsCollector, BatchCollector
# dependencies: 

domain Collector {
  version: "1.0.0"

  type VerifierResult = String
  type ChaosVerifierResult = String
  type CollectorCallback = String
  type ChaosCollectorCallback = String
  type CollectorConfig = String
  type MetricsCollector = String
  type BatchCollector = String

  invariants exports_present {
    - true
  }
}
