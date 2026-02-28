# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatCycleError, formatAllCycles, createGraphBuilder, buildModuleGraph, GraphBuildOptions, ModuleGraphBuilder
# dependencies: 

domain Graph {
  version: "1.0.0"

  type GraphBuildOptions = String
  type ModuleGraphBuilder = String

  invariants exports_present {
    - true
  }
}
