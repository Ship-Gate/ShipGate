/**
 * ISL Linter V2 - Main Export
 *
 * Provides lint functionality with auto-fix suggestions and severity classification.
 */

// Main lint function and utilities
export {
  lint,
  formatLintResult,
  lintResultToJSON,
  lintResultToSARIF,
  getRules,
  getRule,
  getDiagnosticsBySeverity,
  getDiagnosticsByCategory,
  getFixableDiagnostics,
  getAutoFixableDiagnostics,
} from './lint.js';

// Fix application
export {
  applyFix,
  applyFixes,
  getAutoFixableFixes,
  sortFixesByPriority,
  filterFixesByCategory,
  getBestFix,
  validateFix,
  previewPatch,
  patchFactory,
  createFixFactory,
} from './fixes.js';

// Rules
export { ALL_RULES, RULES_BY_ID, RULES_BY_NAME } from './rules.js';

// Individual rules for custom configurations
export {
  minimumConstraintsRule,
  missingPostconditionsRule,
  ambiguousActorRule,
  impossibleConstraintsRule,
  missingErrorSpecRule,
  unconstrainedNumericInputRule,
  duplicatePreconditionsRule,
  missingTemporalConstraintsRule,
} from './rules.js';

// Types
export type {
  // Severity and Categories
  LintSeverity,
  LintCategory,
  // Diagnostics
  LintDiagnostic,
  RelatedLocation,
  LintResult,
  // Rules
  LintRule,
  LintRuleConfig,
  LintRuleChecker,
  LintContext,
  DiagnosticParams,
  // Options
  LintOptions,
  // Fixes
  LintFix,
  ASTPatch,
  ASTPatchType,
  ASTPatchBase,
  InsertPatch,
  ReplacePatch,
  RemovePatch,
  WrapPatch,
  ModifyPatch,
  ApplyFixResult,
  // Factories
  PatchFactory,
  FixFactory,
  // Constraints
  MinimumConstraints,
} from './types.js';

// Constants
export { SEVERITY_LEVEL, SECURITY_PATTERNS, MINIMUM_CONSTRAINTS } from './types.js';
