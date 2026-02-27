# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAnalyzer, STANDARD_ANALYZER, KEYWORD_ANALYZER, SIMPLE_ANALYZER, STOP_ANALYZER, LowercaseFilter, StopFilter, SynonymFilter, StemmerFilter, LengthFilter, DefaultAnalyzer
# dependencies: 

domain Analyzer {
  version: "1.0.0"

  type LowercaseFilter = String
  type StopFilter = String
  type SynonymFilter = String
  type StemmerFilter = String
  type LengthFilter = String
  type DefaultAnalyzer = String

  invariants exports_present {
    - true
  }
}
