# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: optimize, getOptimizationStats, DeadCodeElimination, ConstantFolding, LocalCoalescing, StackToLocal, FunctionInlining, AllPasses, OptimizationLevel, OptimizationPass, OptimizationStats
# dependencies: 

domain Optimization {
  version: "1.0.0"

  type OptimizationLevel = String
  type OptimizationPass = String
  type OptimizationStats = String

  invariants exports_present {
    - true
  }
}
