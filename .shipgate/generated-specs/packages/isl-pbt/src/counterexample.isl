# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildCounterexample, shrinkWithConstraints, serializeCounterexample, parseCounterexample, formatCounterexample, counterexampleRegistry, Counterexample, PropertyInfo, ShrinkStats, ShrinkStrategy, ShrinkConfig, CounterexampleRegistry
# dependencies: 

domain Counterexample {
  version: "1.0.0"

  type Counterexample = String
  type PropertyInfo = String
  type ShrinkStats = String
  type ShrinkStrategy = String
  type ShrinkConfig = String
  type CounterexampleRegistry = String

  invariants exports_present {
    - true
  }
}
