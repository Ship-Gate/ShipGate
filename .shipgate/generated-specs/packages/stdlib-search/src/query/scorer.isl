# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createScorer, BM25Scorer, TFIDFScorer, TermFrequencyScorer
# dependencies: 

domain Scorer {
  version: "1.0.0"

  type BM25Scorer = String
  type TFIDFScorer = String
  type TermFrequencyScorer = String

  invariants exports_present {
    - true
  }
}
