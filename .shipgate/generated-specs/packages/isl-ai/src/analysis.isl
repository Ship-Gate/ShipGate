# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyze, AnalysisResult, SpecInsight, AnalysisSuggestion, ComplexityMetrics, CoverageMetrics
# dependencies: 

domain Analysis {
  version: "1.0.0"

  type AnalysisResult = String
  type SpecInsight = String
  type AnalysisSuggestion = String
  type ComplexityMetrics = String
  type CoverageMetrics = String

  invariants exports_present {
    - true
  }
}
