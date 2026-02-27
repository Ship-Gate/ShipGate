/**
 * Tri-state scoring implementation for ISL Agent
 *
 * Computes scores based on clause evaluation results using weighted scoring:
 * - PASS = 1.0 (full credit)
 * - PARTIAL = 0.4 (partial credit)
 * - FAIL = 0.0 (no credit)
 */

import type {
  ClauseResult,
  ClauseState,
  ScoreBreakdown,
  ScoringResult,
  ScoringWeights,
  ShipDecision,
  ShipThresholds,
} from './scoringTypes.js';

/**
 * Default weights for clause states
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  PASS: 1.0,
  PARTIAL: 0.4,
  FAIL: 0.0,
} as const;

/**
 * Default thresholds for ship decision
 * - score >= 85 AND failCount == 0 => SHIP
 */
export const DEFAULT_THRESHOLDS: ShipThresholds = {
  minScore: 85,
  maxFailures: 0,
} as const;

/**
 * Count occurrences of each clause state
 */
function countStates(results: ClauseResult[]): ScoreBreakdown {
  let passCount = 0;
  let partialCount = 0;
  let failCount = 0;

  for (const result of results) {
    switch (result.state) {
      case 'PASS':
        passCount++;
        break;
      case 'PARTIAL':
        partialCount++;
        break;
      case 'FAIL':
        failCount++;
        break;
    }
  }

  return {
    passCount,
    partialCount,
    failCount,
    totalCount: results.length,
  };
}

/**
 * Calculate the weighted score from clause results
 *
 * @param breakdown - The count breakdown of clause states
 * @param weights - The weights to apply (defaults to DEFAULT_WEIGHTS)
 * @returns Normalized score from 0 to 100
 */
function calculateWeightedScore(
  breakdown: ScoreBreakdown,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const { passCount, partialCount, failCount, totalCount } = breakdown;

  // Handle empty case - return 0 score
  if (totalCount === 0) {
    return 0;
  }

  const weightedSum =
    passCount * weights.PASS +
    partialCount * weights.PARTIAL +
    failCount * weights.FAIL;

  // Normalize to 0-100 scale
  const maxPossible = totalCount * weights.PASS;
  const normalizedScore = (weightedSum / maxPossible) * 100;

  // Round to 2 decimal places for cleaner output
  return Math.round(normalizedScore * 100) / 100;
}

/**
 * Determine ship decision based on score and failure count
 *
 * @param score - The calculated score (0-100)
 * @param failCount - Number of failed clauses
 * @param thresholds - The thresholds to apply (defaults to DEFAULT_THRESHOLDS)
 * @returns SHIP if criteria met, NO_SHIP otherwise
 */
function determineShipDecision(
  score: number,
  failCount: number,
  thresholds: ShipThresholds = DEFAULT_THRESHOLDS
): ShipDecision {
  if (score >= thresholds.minScore && failCount <= thresholds.maxFailures) {
    return 'SHIP';
  }
  return 'NO_SHIP';
}

/**
 * Compute the overall score from a list of clause results
 *
 * @param clauseResults - Array of clause evaluation results
 * @param weights - Optional custom weights (defaults to standard weights)
 * @param thresholds - Optional custom thresholds (defaults to standard thresholds)
 * @returns Complete scoring result with score, breakdown, and ship decision
 *
 * @example
 * ```typescript
 * const results: ClauseResult[] = [
 *   { clauseId: 'auth-1', state: 'PASS' },
 *   { clauseId: 'auth-2', state: 'PARTIAL' },
 *   { clauseId: 'auth-3', state: 'PASS' },
 * ];
 *
 * const score = computeScore(results);
 * // score.score = 80 (2 * 1.0 + 1 * 0.4) / 3 * 100
 * // score.breakdown = { passCount: 2, partialCount: 1, failCount: 0, totalCount: 3 }
 * // score.shipDecision = 'NO_SHIP' (score < 85)
 * ```
 */
export function computeScore(
  clauseResults: ClauseResult[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  thresholds: ShipThresholds = DEFAULT_THRESHOLDS
): ScoringResult {
  const breakdown = countStates(clauseResults);
  const score = calculateWeightedScore(breakdown, weights);
  const shipDecision = determineShipDecision(score, breakdown.failCount, thresholds);

  return {
    score,
    breakdown,
    shipDecision,
  };
}

/**
 * Create a clause result helper
 */
export function createClauseResult(
  clauseId: string,
  state: ClauseState,
  message?: string
): ClauseResult {
  return {
    clauseId,
    state,
    ...(message && { message }),
  };
}

/**
 * Check if a scoring result meets ship criteria
 */
export function canShip(result: ScoringResult): boolean {
  return result.shipDecision === 'SHIP';
}
