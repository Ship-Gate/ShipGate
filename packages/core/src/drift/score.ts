/**
 * Drift Score Calculator
 *
 * Computes a numeric drift score (0–100) from a set of drift indicators.
 * The score is NOT all-or-nothing — it uses weighted contributions
 * from each indicator based on type and severity.
 */

import type { DriftIndicator, DriftSeverity } from './driftTypes.js';

// ============================================================================
// WEIGHTS
// ============================================================================

/**
 * Base weight per indicator type.
 *
 * Higher weight = bigger contribution to drift score.
 */
const TYPE_WEIGHTS: Record<DriftIndicator['type'], number> = {
  signature_change: 25,
  new_behavior: 15,
  removed_behavior: 20,
  dependency_change: 8,
  structural_change: 10,
};

/**
 * Severity multiplier applied on top of type weight.
 */
const SEVERITY_MULTIPLIERS: Record<DriftIndicator['severity'], number> = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
};

// ============================================================================
// SCORE CALCULATION
// ============================================================================

/**
 * Calculate a drift score (0–100) from a list of indicators.
 *
 * The score is the sum of weighted indicator contributions, clamped to [0, 100].
 * An empty indicator list yields 0 (perfectly in sync).
 *
 * @param indicators - The drift indicators to score
 * @returns Drift score between 0 and 100
 */
export function calculateDriftScore(indicators: DriftIndicator[]): number {
  if (indicators.length === 0) return 0;

  let rawScore = 0;

  for (const indicator of indicators) {
    const baseWeight = TYPE_WEIGHTS[indicator.type] ?? 10;
    const multiplier = SEVERITY_MULTIPLIERS[indicator.severity] ?? 1.0;
    rawScore += baseWeight * multiplier;
  }

  // Clamp to 0–100
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Derive a severity bucket from a drift score.
 *
 * @param score - Drift score (0–100)
 * @returns Severity label
 */
export function scoreSeverity(score: number): DriftSeverity {
  if (score === 0) return 'in-sync';
  if (score <= 20) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}
