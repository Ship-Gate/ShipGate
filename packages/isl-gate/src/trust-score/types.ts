/**
 * Trust Score Engine - Type Definitions
 *
 * Types for the 0-100 trust score system that evaluates ISL contracts
 * across six verification categories.
 *
 * @module @isl-lang/gate/trust-score/types
 */

// ============================================================================
// Category Types
// ============================================================================

/**
 * The six verification categories that feed into the trust score.
 */
export type TrustCategory =
  | 'preconditions'
  | 'postconditions'
  | 'invariants'
  | 'temporal'
  | 'chaos'
  | 'coverage';

/** All trust categories in canonical order */
export const TRUST_CATEGORIES: readonly TrustCategory[] = [
  'preconditions',
  'postconditions',
  'invariants',
  'temporal',
  'chaos',
  'coverage',
] as const;

/**
 * Status of a single clause or category.
 *
 * - pass:    fully verified
 * - fail:    verification failed
 * - partial: partially verified (degraded confidence)
 * - unknown: not evaluated (subject to partial penalty)
 */
export type ClauseStatus = 'pass' | 'fail' | 'partial' | 'unknown';

// ============================================================================
// Input Types
// ============================================================================

/**
 * A single clause result from verification.
 */
export interface TrustClauseResult {
  /** Unique identifier for this clause */
  id: string;
  /** Which category this clause belongs to */
  category: TrustCategory;
  /** Human-readable description */
  description: string;
  /** Verification status */
  status: ClauseStatus;
  /** Optional confidence in this result (0-100) */
  confidence?: number;
  /** Optional error message if failed */
  message?: string;
  /** Optional evidence artifact path */
  evidence?: string;
}

/**
 * Input for the trust score calculator.
 * Accepts clause-level results grouped by category.
 */
export interface TrustScoreInput {
  /** All clause results from verification */
  clauses: TrustClauseResult[];
  /** Optional metadata about the verification run */
  metadata?: {
    specFile?: string;
    implFile?: string;
    timestamp?: string;
    durationMs?: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configurable weights for each trust category.
 * Values are relative -- they are normalized to sum to 1.0 internally.
 */
export type TrustWeights = Record<TrustCategory, number>;

/**
 * Default weights. Preconditions, postconditions, and invariants are
 * the backbone of design-by-contract; temporal and coverage provide
 * additional assurance; chaos is supplementary.
 */
export const DEFAULT_WEIGHTS: Readonly<TrustWeights> = {
  preconditions: 20,
  postconditions: 20,
  invariants: 20,
  temporal: 15,
  chaos: 10,
  coverage: 15,
} as const;

/**
 * Full trust score configuration.
 */
export interface TrustScoreConfig {
  /** Weights per category (defaults to DEFAULT_WEIGHTS) */
  weights?: Partial<TrustWeights>;

  /**
   * Penalty multiplier applied to categories with status 'unknown'.
   * 0.0 = no penalty (unknown treated as pass)
   * 1.0 = full penalty (unknown treated as fail)
   * Default: 0.5 (50% penalty)
   */
  unknownPenalty?: number;

  /**
   * Minimum score threshold for SHIP verdict.
   * Default: 80
   */
  shipThreshold?: number;

  /**
   * Minimum score threshold for WARN verdict (below this = BLOCK).
   * Default: 60
   */
  warnThreshold?: number;

  /**
   * If true, a single failing critical clause forces score to 0.
   * Default: true
   */
  criticalFailsBlock?: boolean;

  /**
   * Path to history file for delta detection.
   * Default: '.isl-gate/trust-history.json'
   */
  historyPath?: string;

  /**
   * Maximum history entries to retain.
   * Default: 50
   */
  maxHistoryEntries?: number;
}

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedTrustConfig {
  weights: TrustWeights;
  normalizedWeights: TrustWeights;
  unknownPenalty: number;
  shipThreshold: number;
  warnThreshold: number;
  criticalFailsBlock: boolean;
  historyPath: string;
  maxHistoryEntries: number;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Score breakdown for a single category.
 */
export interface CategoryScore {
  /** The category */
  category: TrustCategory;
  /** Raw score for this category (0-100) */
  score: number;
  /** Weight applied to this category (normalized, 0-1) */
  weight: number;
  /** Weighted contribution to overall score */
  weightedScore: number;
  /** Number of clauses in this category */
  clauseCount: number;
  /** Status counts within this category */
  counts: {
    pass: number;
    fail: number;
    partial: number;
    unknown: number;
  };
}

/**
 * Trust score verdict.
 */
export type TrustVerdict = 'SHIP' | 'WARN' | 'BLOCK';

/**
 * The complete trust score result.
 */
export interface TrustScoreResult {
  /** Overall trust score 0-100 (integer) */
  score: number;
  /** Verdict based on thresholds */
  verdict: TrustVerdict;
  /** Per-category score breakdown */
  categories: CategoryScore[];
  /** Total clauses evaluated */
  totalClauses: number;
  /** Aggregate status counts */
  counts: {
    pass: number;
    fail: number;
    partial: number;
    unknown: number;
  };
  /** Whether a critical blocker forced the verdict */
  criticalBlock: boolean;
  /** Reasons for the verdict */
  reasons: string[];
  /** The resolved configuration used */
  config: ResolvedTrustConfig;
  /** Timestamp of this evaluation */
  timestamp: string;
}

// ============================================================================
// History & Delta Types
// ============================================================================

/**
 * A single entry in the trust score history.
 */
export interface TrustHistoryEntry {
  /** Overall score */
  score: number;
  /** Verdict */
  verdict: TrustVerdict;
  /** Per-category scores */
  categoryScores: Record<TrustCategory, number>;
  /** ISO timestamp */
  timestamp: string;
  /** Optional spec file path */
  specFile?: string;
  /** Optional git commit hash */
  commitHash?: string;
  /** Clause counts */
  counts: {
    pass: number;
    fail: number;
    partial: number;
    unknown: number;
  };
}

/**
 * Delta between two trust score evaluations.
 */
export interface TrustDelta {
  /** Change in overall score */
  scoreDelta: number;
  /** Whether verdict changed */
  verdictChanged: boolean;
  /** Previous verdict (if changed) */
  previousVerdict?: TrustVerdict;
  /** Per-category deltas */
  categoryDeltas: Record<TrustCategory, number>;
  /** Categories that improved */
  improved: TrustCategory[];
  /** Categories that regressed */
  regressed: TrustCategory[];
  /** Categories that stayed the same */
  unchanged: TrustCategory[];
  /** Human-readable summary of changes */
  summary: string;
}

/**
 * Full trust history with metadata.
 */
export interface TrustHistory {
  /** Version of the history format */
  version: 1;
  /** History entries ordered newest-first */
  entries: TrustHistoryEntry[];
  /** Last updated timestamp */
  lastUpdated: string;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Trust score report with formatting metadata.
 */
export interface TrustReport {
  /** The trust score result */
  result: TrustScoreResult;
  /** Delta from previous run (if history available) */
  delta?: TrustDelta;
  /** Formatted text report */
  text: string;
  /** JSON-serializable report */
  json: TrustReportJSON;
}

/**
 * JSON-serializable trust report.
 */
export interface TrustReportJSON {
  score: number;
  verdict: TrustVerdict;
  threshold: number;
  categories: Array<{
    name: TrustCategory;
    score: number;
    weight: number;
    pass: number;
    fail: number;
    partial: number;
    unknown: number;
  }>;
  counts: {
    pass: number;
    fail: number;
    partial: number;
    unknown: number;
    total: number;
  };
  delta?: {
    scoreDelta: number;
    verdictChanged: boolean;
    improved: TrustCategory[];
    regressed: TrustCategory[];
  };
  timestamp: string;
  reasons: string[];
}
