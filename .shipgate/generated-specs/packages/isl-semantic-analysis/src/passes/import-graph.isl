# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildImportGraph, hasDirectCycle, getTransitiveDeps, getProcessingOrder, ImportGraphPass, importGraphPass, ImportGraphNode, ImportGraphResult
# dependencies: 

domain ImportGraph {
  version: "1.0.0"

  type ImportGraphNode = String
  type ImportGraphResult = String

  invariants exports_present {
    - true
  }
}
