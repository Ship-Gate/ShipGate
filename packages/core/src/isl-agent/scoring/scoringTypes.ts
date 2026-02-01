/**
 * Tri-state scoring types for ISL Agent clause evaluation
 */

/**
 * Possible states for a clause evaluation result
 */
export type ClauseState = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Ship decision based on scoring thresholds
 */
export type ShipDecision = 'SHIP' | 'NO_SHIP';

/**
 * Result of evaluating a single clause
 */
export interface ClauseResult {
  /** Unique identifier for the clause */
  clauseId: string;
  /** The evaluation state of this clause */
  state: ClauseState;
  /** Optional message explaining the result */
  message?: string;
}

/**
 * Breakdown of clause evaluation counts
 */
export interface ScoreBreakdown {
  /** Number of clauses that passed */
  passCount: number;
  /** Number of clauses that partially passed */
  partialCount: number;
  /** Number of clauses that failed */
  failCount: number;
  /** Total number of clauses evaluated */
  totalCount: number;
}

/**
 * Complete scoring result with decision
 */
export interface ScoringResult {
  /** Normalized score from 0 to 100 */
  score: number;
  /** Detailed breakdown of results */
  breakdown: ScoreBreakdown;
  /** Ship decision based on thresholds */
  shipDecision: ShipDecision;
}

/**
 * Scoring weights for each clause state
 */
export interface ScoringWeights {
  PASS: number;
  PARTIAL: number;
  FAIL: number;
}

/**
 * Thresholds for ship decision
 */
export interface ShipThresholds {
  /** Minimum score required to ship */
  minScore: number;
  /** Maximum allowed failures to ship */
  maxFailures: number;
}
