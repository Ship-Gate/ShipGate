# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AnalysisOptions, AnalysisResult, ISLAnalyzer
# dependencies: @isl-lang/parser, @isl-lang/typechecker

domain Analyzer {
  version: "1.0.0"

  type AnalysisOptions = String
  type AnalysisResult = String
  type ISLAnalyzer = String

  invariants exports_present {
    - true
  }
}
