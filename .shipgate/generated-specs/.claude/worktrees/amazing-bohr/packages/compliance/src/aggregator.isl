# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: aggregateCompliance, FrameworkScore, CrossFrameworkGap, AggregatedCompliance, ComplianceAggregator
# dependencies: 

domain Aggregator {
  version: "1.0.0"

  type FrameworkScore = String
  type CrossFrameworkGap = String
  type AggregatedCompliance = String
  type ComplianceAggregator = String

  invariants exports_present {
    - true
  }
}
