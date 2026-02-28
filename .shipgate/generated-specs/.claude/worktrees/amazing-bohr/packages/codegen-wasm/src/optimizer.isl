# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: optimizeModule, formatOptimizationStats, OptimizationLevel, OptimizationOptions, OptimizationResult, OptimizationStats
# dependencies: 

domain Optimizer {
  version: "1.0.0"

  type OptimizationLevel = String
  type OptimizationOptions = String
  type OptimizationResult = String
  type OptimizationStats = String

  invariants exports_present {
    - true
  }
}
