# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateScore, getVerdict, explainScore, DEFAULT_SCORING, ScoringConfig, ViolationCount
# dependencies: 

domain Scoring {
  version: "1.0.0"

  type ScoringConfig = String
  type ViolationCount = String

  invariants exports_present {
    - true
  }
}
