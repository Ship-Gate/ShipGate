# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTokenizer, StandardTokenizer, WhitespaceTokenizer, KeywordTokenizer, LetterTokenizer, NGramTokenizer, EdgeNGramTokenizer, PathTokenizer, PatternTokenizer
# dependencies: 

domain Tokenizer {
  version: "1.0.0"

  type StandardTokenizer = String
  type WhitespaceTokenizer = String
  type KeywordTokenizer = String
  type LetterTokenizer = String
  type NGramTokenizer = String
  type EdgeNGramTokenizer = String
  type PathTokenizer = String
  type PatternTokenizer = String

  invariants exports_present {
    - true
  }
}
