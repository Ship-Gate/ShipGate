# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateMetrics, benchmark, comparePerformance, formatMetrics, formatComparisonTable, PerformanceMetrics, PerformanceResult, PerformanceRankings, PerformanceSummary, PerformanceOptions, RankingWeights, TimingData
# dependencies: 

domain Performance {
  version: "1.0.0"

  type PerformanceMetrics = String
  type PerformanceResult = String
  type PerformanceRankings = String
  type PerformanceSummary = String
  type PerformanceOptions = String
  type RankingWeights = String
  type TimingData = String

  invariants exports_present {
    - true
  }
}
