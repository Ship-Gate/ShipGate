/**
 * ISL Healer - Self-Healing Pipeline
 *
 * Heal until ship: run gate → map violations → apply patches → rerun gate
 *
 * The healer is allowed to:
 * ✓ Add missing enforcement (rate limiting, audit, validation, encryption)
 * ✓ Add missing intent anchors in required places
 * ✓ Refactor within touched files minimally
 * ✓ Add tests required by the spec
 *
 * The healer is NOT allowed to:
 * ✗ Remove intents from the ISL spec
 * ✗ Add suppressions automatically
 * ✗ Downgrade severity
 * ✗ Change gate rules/packs
 * ✗ Broaden allowlists / weaken security
 * ✗ "Make it pass" by hiding violations
 * ✗ Guess fixes for unknown rules
 *
 * That's the moat: proof that passing means something.
 *
 * @module @isl-lang/healer
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  Severity,
  GateVerdict,
  ProofVerdict,
  HealReason,

  // Violation types
  Span,
  ViolationEvidence,
  Violation,

  // Gate result types
  SarifLocation,
  SarifResult,
  SarifRun,
  SarifReport,
  GateResultJSON,
  GateResult,

  // Fix recipe types
  MatchPattern,
  LocateStrategy,
  PatchOperation,
  PatchValidation,
  FixRecipe,
  FixContext,
  PatchRecord,

  // Framework adapter types
  SupportedFramework,
  FrameworkDetection,
  FrameworkAdapter,

  // Proof bundle v2 types
  IterationSnapshot,
  BuildProof,
  TestProof,
  ClauseEvidence,
  ProofChainEntry,
  ProofBundleV2,

  // Heal result types
  HealResult,
  HealOptions,

  // ISL AST types
  ISLAST,
  ISLEntity,
  ISLBehavior,
  ISLInvariant,
  ISLType,

  // Registry types
  FixRecipeRegistry,

  // Guard types
  WeakeningPattern,
  WeakeningCheckResult,
} from './types.js';

// ============================================================================
// Healer Core
// ============================================================================

export {
  ISLHealerV2,
  healUntilShip,
  createHealer,
  createMockGateResult,
  createViolation,
} from './healer.js';

// ============================================================================
// Gate Ingestion
// ============================================================================

export { GateIngester } from './gate-ingester.js';

// Helper functions (implemented on class, exported as convenience)
export function parseStudioJSON(input: string | object) {
  return new (require('./gate-ingester.js').GateIngester)().parse(input);
}

export function parseSarifReport(input: string | object) {
  return new (require('./gate-ingester.js').GateIngester)().parse(input);
}

export function computeFingerprint(violation: { file: string; ruleId: string; message: string }) {
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update(`${violation.file}:${violation.ruleId}:${violation.message}`)
    .digest('hex')
    .slice(0, 16);
}

export interface IngesterOptions {
  strict?: boolean;
  includeContext?: boolean;
}

// ============================================================================
// Recipe Registry
// ============================================================================

export { FixRecipeRegistryImpl } from './recipe-registry.js';

import type { FixRecipe, FixRecipeRegistry, PatchOperation } from './types.js';

// Factory functions
export function createRecipeRegistry(): FixRecipeRegistry {
  const { FixRecipeRegistryImpl } = require('./recipe-registry.js');
  return new FixRecipeRegistryImpl();
}

export function createDefaultRegistry(): FixRecipeRegistry {
  const { FixRecipeRegistryImpl, BUILTIN_RECIPES } = require('./recipe-registry.js');
  const registry = new FixRecipeRegistryImpl();
  for (const recipe of BUILTIN_RECIPES) {
    registry.register(recipe);
  }
  return registry;
}

export function defineRecipe(recipe: FixRecipe): FixRecipe {
  return recipe;
}

export function createInsertPatch(file: string, content: string, description?: string): PatchOperation {
  return { type: 'insert', file, content, description: description || 'Insert content' };
}

export function createReplacePatch(file: string, content: string, description?: string): PatchOperation {
  return { type: 'replace', file, content, description: description || 'Replace content' };
}

export function createDeletePatch(file: string, content: string, description?: string): PatchOperation {
  return { type: 'delete', file, content, description: description || 'Delete content' };
}

export function createWrapPatch(file: string, content: string, wrapPrefix: string, wrapSuffix: string, description?: string): PatchOperation {
  return { type: 'wrap', file, content, wrapPrefix, wrapSuffix, description: description || 'Wrap content' };
}

// ============================================================================
// Weakening Guard
// ============================================================================

export {
  WeakeningGuard,
  WeakeningError,
  WEAKENING_PATTERNS,
  createWeakeningGuard,
  containsWeakening,
  validatePatchSafe,
} from './weakening-guard.js';

export type { WeakeningGuardOptions } from './weakening-guard.js';

// ============================================================================
// Proof Builder
// ============================================================================

export {
  ProofBundleV2Builder,
  generateClauseEvidence,
} from './proof-builder.js';

// ============================================================================
// Framework Adapters
// ============================================================================

export {
  getFrameworkAdapter,
  detectFramework,
  getAdapterForProject,
  NextJSAppAdapter,
  NextJSPagesAdapter,
  ExpressAdapter,
  FastifyAdapter,
} from './adapters/index.js';

// ============================================================================
// Built-in Recipes
// ============================================================================

export {
  BUILTIN_RECIPES,
  getBuiltinRecipeIds,
  getBuiltinRecipe,
  RateLimitRecipe,
  AuditRecipe,
  NoPIILoggingRecipe,
  PIIConsoleRecipe,
  InputValidationRecipe,
  IdempotencyRecipe,
  ServerSideAmountRecipe,
  EncryptionRecipe,
  AuthRequiredRecipe,
  NoStubbedHandlersRecipe,
} from './recipes/index.js';

// ============================================================================
// AST Semantic Rules (Next.js Route Handlers)
// ============================================================================

export {
  // Rules
  auditRequiredRule,
  rateLimitRequiredRule,
  noPiiLoggingRule,
  noStubbedHandlersRule,
  AST_SEMANTIC_RULES,
  runASTSemanticRules,
  getRule,
  // Deterministic recipes
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
} from './rules/index.js';

export type {
  // Rule types
  SemanticViolation,
  SemanticRule,
  SemanticRuleConfig,
  ExitPath,
  AuditCall,
  HandlerInfo,
  // Recipe types
  DeterministicPatch,
  FixRecipe as DeterministicFixRecipe,
  FixContext as DeterministicFixContext,
  ValidationResult as RecipeValidationResult,
  ApplyResult,
} from './rules/index.js';
