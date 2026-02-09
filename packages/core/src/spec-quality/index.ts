/**
 * ISL Spec Quality Scorer
 *
 * A linter for specs themselves — rates ISL specifications across five
 * quality dimensions and suggests improvements.
 *
 * @example
 * ```typescript
 * import { scoreSpec, formatReport } from '@isl-lang/core/spec-quality';
 * import { parse } from '@isl-lang/parser';
 *
 * const { domain } = parse(source, filePath);
 * if (domain) {
 *   const report = scoreSpec(domain, filePath);
 *   console.log(formatReport(report));
 * }
 * ```
 */

export { scoreSpec, formatReport } from './scorer.js';
export type {
  SpecQualityReport,
  SpecQualityOptions,
  DimensionScore,
  QualitySuggestion,
  QualityDimension,
  DimensionChecker,
  DimensionCheckResult,
} from './types.js';
export { DEFAULT_WEIGHTS } from './types.js';

// Re-export individual checkers for testing / customisation
export {
  completenessChecker,
  specificityChecker,
  securityChecker,
  testabilityChecker,
  consistencyChecker,
} from './checkers/index.js';
