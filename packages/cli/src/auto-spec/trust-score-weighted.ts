/**
 * Tiered Trust Score Calculator
 *
 * Applies tier weights to file scores:
 * - Tier 1: 3x weight (route handlers, services, business logic)
 * - Tier 2: 2x weight (entity models, schemas)
 * - Tier 3: 1x weight (utilities, config, middleware)
 *
 * @module @isl-lang/cli/auto-spec
 */

import type { VerificationTier, TierConfig } from './tiered-verification.js';
import { DEFAULT_TIER_CONFIG } from './tiered-verification.js';

export interface WeightedFileScore {
  file: string;
  score: number;
  tier: VerificationTier;
  weight: number;
  weightedScore: number;
}

/**
 * Calculate weighted trust score from per-file results.
 */
export function calculateWeightedTrustScore(
  fileScores: Array<{ file: string; score: number; tier: VerificationTier }>,
  config: TierConfig = DEFAULT_TIER_CONFIG
): { overallScore: number; weightedFiles: WeightedFileScore[] } {
  const getWeight = (tier: VerificationTier): number => {
    switch (tier) {
      case 1:
        return config.tier1Weight;
      case 2:
        return config.tier2Weight;
      case 3:
        return config.tier3Weight;
      default:
        return config.tier2Weight;
    }
  };

  const weightedFiles: WeightedFileScore[] = fileScores.map((f) => {
    const weight = getWeight(f.tier);
    return {
      file: f.file,
      score: f.score,
      tier: f.tier,
      weight,
      weightedScore: f.score * weight,
    };
  });

  const totalWeighted = weightedFiles.reduce((sum, f) => sum + f.weightedScore, 0);
  const totalWeight = weightedFiles.reduce((sum, f) => sum + f.weight, 0);
  const overallScore = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    weightedFiles,
  };
}
