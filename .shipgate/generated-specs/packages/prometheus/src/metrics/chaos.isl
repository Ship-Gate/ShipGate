# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ChaosMetrics
# dependencies: prom-client

domain Chaos {
  version: "1.0.0"

  type ChaosMetrics = String

  invariants exports_present {
    - true
  }
}
