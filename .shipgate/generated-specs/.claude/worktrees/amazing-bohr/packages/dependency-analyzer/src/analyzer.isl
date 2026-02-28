# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeDependencies, ParseResult, AnalyzerOptions, DependencyNode, DependencyEdge, DependencyGraph, DomainSummary, DependencyAnalyzer
# dependencies: @isl-lang/parser, @isl-lang/isl-core/adapters

domain Analyzer {
  version: "1.0.0"

  type ParseResult = String
  type AnalyzerOptions = String
  type DependencyNode = String
  type DependencyEdge = String
  type DependencyGraph = String
  type DomainSummary = String
  type DependencyAnalyzer = String

  invariants exports_present {
    - true
  }
}
