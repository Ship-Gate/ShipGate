# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseFuzzy, ParseWarning, PartialNode, FuzzyParseResult
# dependencies: 

domain FuzzyParser {
  version: "1.0.0"

  type ParseWarning = String
  type PartialNode = String
  type FuzzyParseResult = String

  invariants exports_present {
    - true
  }
}
