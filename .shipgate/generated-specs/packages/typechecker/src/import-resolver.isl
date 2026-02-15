# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ImportGraphNode, ImportGraph, ImportResolverOptions, ImportGraphResolver
# dependencies: node:path

domain ImportResolver {
  version: "1.0.0"

  type ImportGraphNode = String
  type ImportGraph = String
  type ImportResolverOptions = String
  type ImportGraphResolver = String

  invariants exports_present {
    - true
  }
}
