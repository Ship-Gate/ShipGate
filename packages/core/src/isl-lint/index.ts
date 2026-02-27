/**
 * ISL Semantic Linter
 * 
 * Provides semantic analysis and linting for ISL specifications.
 * 
 * @example
 * ```typescript
 * import { parse } from '@isl-lang/parser';
 * import { lint, formatLintResult } from '@isl-lang/core/isl-lint';
 * 
 * const { domain, errors } = parse(source);
 * if (domain) {
 *   const result = lint(domain);
 *   console.log(formatLintResult(result));
 * }
 * ```
 */

export {
  lint,
  formatLintResult,
  getRules,
  getRule,
  ALL_RULES,
  RULES_BY_ID,
  RULES_BY_NAME,
} from './lint.js';

export * from './lintTypes.js';

export {
  missingPostconditionsRule,
  ambiguousActorRule,
  securitySensitiveNoConstraintsRule,
  impossibleConstraintsRule,
  emptyErrorSpecRule,
  missingInputValidationRule,
} from './lintRules.js';
