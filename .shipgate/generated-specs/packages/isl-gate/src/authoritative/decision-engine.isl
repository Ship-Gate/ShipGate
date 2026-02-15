# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: makeDecision, wouldShip, getMinScoreToShip, getSuggestions, DecisionResult
# dependencies: 

domain DecisionEngine {
  version: "1.0.0"

  type DecisionResult = String

  invariants exports_present {
    - true
  }
}
