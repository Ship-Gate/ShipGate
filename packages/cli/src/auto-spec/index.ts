/**
 * Auto-spec and tiered verification
 *
 * @module @isl-lang/cli/auto-spec
 */

export {
  generateUtilitySpec,
  isUtilityFile,
  type AutoSpecResult,
  type ExtractedExport,
  type ExtractedDependency,
} from './auto-spec-generator.js';

export {
  classifyTier,
  isRelaxedTier,
  DEFAULT_TIER_CONFIG,
  type VerificationTier,
  type TierConfig,
} from './tiered-verification.js';

export {
  calculateWeightedTrustScore,
  type WeightedFileScore,
} from './trust-score-weighted.js';
