/**
 * Rules and Recipes Module
 *
 * Exports:
 * - AST-based semantic rules for Next.js route handlers
 * - Deterministic fix recipes that satisfy the semantic checks
 *
 * @module @isl-lang/healer/rules
 */

// AST-based semantic rules
export {
  auditRequiredRule,
  rateLimitRequiredRule,
  noPiiLoggingRule,
  noStubbedHandlersRule,
  AST_SEMANTIC_RULES,
  runASTSemanticRules,
  getRule,
} from './ast-semantic-rules';

export type {
  SemanticViolation,
  SemanticRule,
  SemanticRuleConfig,
  ExitPath,
  AuditCall,
  HandlerInfo,
} from './ast-semantic-rules';

// Deterministic fix recipes
export {
  auditRequiredRecipe,
  rateLimitRequiredRecipe,
  noPiiLoggingRecipe,
  noStubbedHandlersRecipe,
  constantTimeCompareRecipe,
  lockoutThresholdRecipe,
  captchaRequiredRecipe,
  DETERMINISTIC_RECIPES,
  applyRecipe,
  getRecipe,
  hasRecipe,
} from './deterministic-recipes';

export type {
  DeterministicPatch,
  FixRecipe,
  FixContext,
  ValidationResult,
  ApplyResult,
} from './deterministic-recipes';
