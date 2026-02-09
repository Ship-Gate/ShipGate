/**
 * Trust Score Types
 *
 * Comprehensive type definitions for multi-signal trust scoring.
 * The trust score aggregates evidence from:
 * - Static checks
 * - Evaluator verdicts
 * - SMT proofs
 * - PBT (Property-Based Testing) results
 * - Chaos testing outcomes
 *
 * @module @isl-lang/trust-score
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Trust score value bounded to [0, 1]
 */
export type TrustValue = number;

/**
 * Final shipping decision based on trust score
 */
export type ShipDecision = 'SHIP' | 'NO_SHIP' | 'REVIEW_REQUIRED';

/**
 * Signal categories contributing to trust
 */
export type SignalCategory =
  | 'static_checks'
  | 'evaluator_verdicts'
  | 'smt_proofs'
  | 'pbt_results'
  | 'chaos_outcomes';

/**
 * Verdict from an individual signal
 */
export type SignalVerdict = 'pass' | 'fail' | 'unknown' | 'skipped';

// ============================================================================
// SIGNAL EVIDENCE
// ============================================================================

/**
 * Base interface for all signal evidence
 */
export interface SignalEvidence {
  /** Signal category */
  category: SignalCategory;
  /** Timestamp when evidence was collected */
  timestamp: string;
  /** Duration of the check in milliseconds */
  durationMs: number;
}

/**
 * Static analysis check evidence
 */
export interface StaticCheckEvidence extends SignalEvidence {
  category: 'static_checks';
  checks: StaticCheckResult[];
}

export interface StaticCheckResult {
  /** Check identifier (e.g., "type-safety", "null-check") */
  checkId: string;
  /** Human-readable name */
  name: string;
  /** Verdict */
  verdict: SignalVerdict;
  /** Severity if failed */
  severity?: 'error' | 'warning' | 'info';
  /** Details or error message */
  message?: string;
  /** Source location */
  location?: SourceLocation;
}

/**
 * Evaluator verdict evidence (postconditions, invariants, preconditions)
 */
export interface EvaluatorEvidence extends SignalEvidence {
  category: 'evaluator_verdicts';
  clauses: ClauseEvaluation[];
}

export interface ClauseEvaluation {
  /** Clause identifier */
  clauseId: string;
  /** Clause type */
  type: 'postcondition' | 'invariant' | 'precondition';
  /** Expression being evaluated */
  expression: string;
  /** Verdict */
  verdict: SignalVerdict;
  /** How the verdict was determined */
  resolvedBy?: 'runtime' | 'smt' | 'timeout';
  /** Reason for the verdict */
  reason?: string;
}

/**
 * SMT proof evidence
 */
export interface SMTProofEvidence extends SignalEvidence {
  category: 'smt_proofs';
  proofs: SMTProofResult[];
}

export interface SMTProofResult {
  /** Clause identifier */
  clauseId: string;
  /** Verdict from SMT solver */
  verdict: SignalVerdict;
  /** Solver used */
  solver: string;
  /** Solver status */
  solverStatus: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
  /** Duration in milliseconds */
  durationMs: number;
  /** Query hash for reproducibility */
  queryHash?: string;
  /** Counterexample if found */
  counterexample?: Record<string, unknown>;
}

/**
 * Property-Based Testing evidence
 */
export interface PBTEvidence extends SignalEvidence {
  category: 'pbt_results';
  behaviors: PBTBehaviorResult[];
}

export interface PBTBehaviorResult {
  /** Behavior name */
  behaviorName: string;
  /** Overall verdict */
  verdict: SignalVerdict;
  /** Number of test iterations */
  iterations: number;
  /** Number of successes */
  successes: number;
  /** Number of failures */
  failures: number;
  /** Number of filtered/skipped tests */
  filtered: number;
  /** Property violations found */
  violations: PBTViolation[];
}

export interface PBTViolation {
  /** Property expression */
  property: string;
  /** Failing input */
  input: Record<string, unknown>;
  /** Minimal input after shrinking */
  minimalInput?: Record<string, unknown>;
  /** Error message */
  error: string;
}

/**
 * Chaos testing evidence
 */
export interface ChaosEvidence extends SignalEvidence {
  category: 'chaos_outcomes';
  scenarios: ChaosScenarioResult[];
}

export interface ChaosScenarioResult {
  /** Scenario identifier */
  scenarioId: string;
  /** Scenario name */
  name: string;
  /** Fault type injected */
  faultType: string;
  /** Verdict */
  verdict: SignalVerdict;
  /** Whether system recovered */
  recovered: boolean;
  /** Recovery time in milliseconds */
  recoveryTimeMs?: number;
  /** Invariants maintained during chaos */
  invariantsMaintained: boolean;
  /** Details */
  details?: string;
}

/**
 * Source location reference
 */
export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

// ============================================================================
// AGGREGATED EVIDENCE INPUT
// ============================================================================

/**
 * Complete evidence input for trust score calculation
 */
export interface TrustEvidenceInput {
  /** Static analysis results */
  staticChecks?: StaticCheckEvidence;
  /** Evaluator verdicts */
  evaluatorVerdicts?: EvaluatorEvidence;
  /** SMT proof results */
  smtProofs?: SMTProofEvidence;
  /** PBT results */
  pbtResults?: PBTEvidence;
  /** Chaos testing results */
  chaosOutcomes?: ChaosEvidence;
}

// ============================================================================
// SIGNAL SCORES
// ============================================================================

/**
 * Score for an individual signal category
 */
export interface SignalScore {
  /** Signal category */
  category: SignalCategory;
  /** Raw score before weighting [0, 1] */
  rawScore: TrustValue;
  /** Weight applied to this signal */
  weight: number;
  /** Weighted contribution to total [0, 1] */
  weightedScore: TrustValue;
  /** Number of passing items */
  passed: number;
  /** Number of failing items */
  failed: number;
  /** Number of unknown items */
  unknown: number;
  /** Number of skipped items */
  skipped: number;
  /** Total items evaluated */
  total: number;
  /** Whether this signal is available */
  available: boolean;
  /** Explanation of how score was computed */
  explanation: string;
}

// ============================================================================
// TRUST SCORE OUTPUT
// ============================================================================

/**
 * Complete trust score result
 */
export interface TrustScore {
  /** Overall trust score [0, 1] */
  score: TrustValue;
  /** Confidence in the score [0, 1] */
  confidence: TrustValue;
  /** Shipping decision */
  decision: ShipDecision;
  /** Breakdown by signal category */
  signals: SignalScore[];
  /** Human-readable summary */
  summary: TrustSummary;
  /** Factors that reduced trust */
  trustReducers: TrustReducer[];
  /** Recommendations for improving trust */
  recommendations: Recommendation[];
  /** Timestamp of computation */
  computedAt: string;
  /** Version of the scoring algorithm */
  algorithmVersion: string;
}

/**
 * Human-readable summary
 */
export interface TrustSummary {
  /** One-line summary */
  headline: string;
  /** Detailed explanation */
  explanation: string;
  /** Key findings (positive) */
  strengths: string[];
  /** Key concerns */
  concerns: string[];
}

/**
 * Factor that reduced trust score
 */
export interface TrustReducer {
  /** Reducer identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** How much this reduced the score */
  impact: TrustValue;
  /** Category this reducer affects */
  category: SignalCategory | 'overall';
  /** Severity */
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Recommendation for improving trust
 */
export interface Recommendation {
  /** Recommendation identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Expected impact on score */
  expectedImpact: TrustValue;
  /** Priority */
  priority: 'high' | 'medium' | 'low';
  /** Category this addresses */
  category: SignalCategory | 'overall';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for trust score computation
 */
export interface TrustScoreConfig {
  /** Weights for each signal (must sum to 1.0) */
  weights?: SignalWeights;
  /** Thresholds for decisions */
  thresholds?: DecisionThresholds;
  /** Penalty factors */
  penalties?: PenaltyConfig;
  /** Maximum weight for any single signal (prevents domination) */
  maxSingleSignalWeight?: number;
}

/**
 * Weights for each signal category
 */
export interface SignalWeights {
  static_checks?: number;
  evaluator_verdicts?: number;
  smt_proofs?: number;
  pbt_results?: number;
  chaos_outcomes?: number;
}

/**
 * Thresholds for shipping decisions
 */
export interface DecisionThresholds {
  /** Minimum score for SHIP decision */
  ship?: number;
  /** Minimum score for REVIEW_REQUIRED (below this is NO_SHIP) */
  review?: number;
  /** Minimum confidence required for SHIP */
  minConfidence?: number;
}

/**
 * Penalty configuration
 */
export interface PenaltyConfig {
  /** Penalty per unknown result [0, 1] */
  unknownPenalty?: number;
  /** Penalty per failure [0, 1] */
  failurePenalty?: number;
  /** Penalty for missing signal category [0, 1] */
  missingSignalPenalty?: number;
  /** Multiplier for critical failures */
  criticalFailureMultiplier?: number;
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default signal weights (balanced, no single signal dominates)
 */
export const DEFAULT_WEIGHTS: Required<SignalWeights> = {
  static_checks: 0.15,
  evaluator_verdicts: 0.30,
  smt_proofs: 0.25,
  pbt_results: 0.20,
  chaos_outcomes: 0.10,
};

/**
 * Default decision thresholds
 */
export const DEFAULT_THRESHOLDS: Required<DecisionThresholds> = {
  ship: 0.90,
  review: 0.70,
  minConfidence: 0.60,
};

/**
 * Default penalty configuration
 */
export const DEFAULT_PENALTIES: Required<PenaltyConfig> = {
  unknownPenalty: 0.15,
  failurePenalty: 0.25,
  missingSignalPenalty: 0.10,
  criticalFailureMultiplier: 2.0,
};

/**
 * Maximum weight any single signal can have (prevents domination)
 */
export const MAX_SINGLE_SIGNAL_WEIGHT = 0.40;

/**
 * Algorithm version for tracking changes
 */
export const ALGORITHM_VERSION = '1.0.0';
