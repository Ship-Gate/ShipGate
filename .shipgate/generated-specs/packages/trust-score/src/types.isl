# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, DEFAULT_PENALTIES, MAX_SINGLE_SIGNAL_WEIGHT, ALGORITHM_VERSION, TrustValue, ShipDecision, SignalCategory, SignalVerdict, SignalEvidence, StaticCheckEvidence, StaticCheckResult, EvaluatorEvidence, ClauseEvaluation, SMTProofEvidence, SMTProofResult, PBTEvidence, PBTBehaviorResult, PBTViolation, ChaosEvidence, ChaosScenarioResult, SourceLocation, TrustEvidenceInput, SignalScore, TrustScore, TrustSummary, TrustReducer, Recommendation, TrustScoreConfig, SignalWeights, DecisionThresholds, PenaltyConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type TrustValue = String
  type ShipDecision = String
  type SignalCategory = String
  type SignalVerdict = String
  type SignalEvidence = String
  type StaticCheckEvidence = String
  type StaticCheckResult = String
  type EvaluatorEvidence = String
  type ClauseEvaluation = String
  type SMTProofEvidence = String
  type SMTProofResult = String
  type PBTEvidence = String
  type PBTBehaviorResult = String
  type PBTViolation = String
  type ChaosEvidence = String
  type ChaosScenarioResult = String
  type SourceLocation = String
  type TrustEvidenceInput = String
  type SignalScore = String
  type TrustScore = String
  type TrustSummary = String
  type TrustReducer = String
  type Recommendation = String
  type TrustScoreConfig = String
  type SignalWeights = String
  type DecisionThresholds = String
  type PenaltyConfig = String

  invariants exports_present {
    - true
  }
}
