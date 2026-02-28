# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClauseState, ShipDecision, ClauseResult, ScoreBreakdown, ScoringResult, ScoringWeights, ShipThresholds
# dependencies: 

domain ScoringTypes {
  version: "1.0.0"

  type ClauseState = String
  type ShipDecision = String
  type ClauseResult = String
  type ScoreBreakdown = String
  type ScoringResult = String
  type ScoringWeights = String
  type ShipThresholds = String

  invariants exports_present {
    - true
  }
}
