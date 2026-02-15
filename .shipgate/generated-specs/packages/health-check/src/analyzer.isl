# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDependencyAnalyzer, analyzeDomain, analyzeISLSource, AnalyzerConfig, DependencyRule, ISLDependencyAnalyzer, DependencyAnalysisSummary
# dependencies: 

domain Analyzer {
  version: "1.0.0"

  type AnalyzerConfig = String
  type DependencyRule = String
  type ISLDependencyAnalyzer = String
  type DependencyAnalysisSummary = String

  invariants exports_present {
    - true
  }
}
