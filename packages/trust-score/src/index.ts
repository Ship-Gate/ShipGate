/**
 * @isl-lang/trust-score
 *
 * Trust score computation from verification evidence.
 * Computes a score ∈ [0,1] based on multiple verification signals to
 * drive SHIP/NO-SHIP decisions.
 *
 * @example
 * ```typescript
 * import { computeTrustScore, EvidenceBuilder, formatForTerminal } from '@isl-lang/trust-score';
 *
 * const evidence = new EvidenceBuilder()
 *   .withEvaluatorVerdicts([
 *     { clauseId: 'post_1', type: 'postcondition', expression: 'result > 0', verdict: 'pass' },
 *   ])
 *   .withPBTResults([
 *     { behaviorName: 'CreateUser', verdict: 'pass', iterations: 100, successes: 100, failures: 0, filtered: 0, violations: [] },
 *   ])
 *   .build();
 *
 * const score = computeTrustScore(evidence);
 * console.log(formatForTerminal(score));
 * // Decision: SHIP | NO_SHIP | REVIEW_REQUIRED
 * ```
 *
 * @module @isl-lang/trust-score
 */

// Types
export type {
  TrustValue,
  ShipDecision,
  SignalCategory,
  SignalVerdict,
  SignalEvidence,
  StaticCheckEvidence,
  StaticCheckResult,
  EvaluatorEvidence,
  ClauseEvaluation,
  SMTProofEvidence,
  SMTProofResult,
  PBTEvidence,
  PBTBehaviorResult,
  PBTViolation,
  ChaosEvidence,
  ChaosScenarioResult,
  SourceLocation,
  TrustEvidenceInput,
  SignalScore,
  TrustScore,
  TrustSummary,
  TrustReducer,
  Recommendation,
  TrustScoreConfig,
  SignalWeights,
  DecisionThresholds,
  PenaltyConfig,
} from './types.js';

// Constants
export {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  DEFAULT_PENALTIES,
  MAX_SINGLE_SIGNAL_WEIGHT,
  ALGORITHM_VERSION,
} from './types.js';

// Calculator
export { TrustScoreCalculator, computeTrustScore } from './calculator.js';

// Formatters
export { formatAsJSON, formatForTerminal, formatAsMarkdown } from './formatter.js';

// Adapters
export {
  EvidenceBuilder,
  fromVerifyPipelineResult,
  fromPBTReport,
  fromChaosResult,
} from './adapters.js';
