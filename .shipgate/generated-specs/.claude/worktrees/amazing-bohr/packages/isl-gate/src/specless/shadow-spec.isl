# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseSource, generateShadowSpec, recognizers, FunctionInfo, ImportInfo, RouteHandlerInfo, SourceAST, PatternMatch, PatternRecognizer, ShadowSpec
# dependencies: 

domain ShadowSpec {
  version: "1.0.0"

  type FunctionInfo = String
  type ImportInfo = String
  type RouteHandlerInfo = String
  type SourceAST = String
  type PatternMatch = String
  type PatternRecognizer = String
  type ShadowSpec = String

  invariants exports_present {
    - true
  }
}
