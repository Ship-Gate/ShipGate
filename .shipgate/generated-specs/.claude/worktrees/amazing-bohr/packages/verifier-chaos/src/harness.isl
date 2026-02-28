# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createHarness, HarnessConfig, ScenarioOutcome, ScenarioMetrics, TrialResult, HarnessResult, AggregatedMetrics, ChaosHarness, ScenarioRunner
# dependencies: 

domain Harness {
  version: "1.0.0"

  type HarnessConfig = String
  type ScenarioOutcome = String
  type ScenarioMetrics = String
  type TrialResult = String
  type HarnessResult = String
  type AggregatedMetrics = String
  type ChaosHarness = String
  type ScenarioRunner = String

  invariants exports_present {
    - true
  }
}
