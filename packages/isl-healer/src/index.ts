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

export {
  GateIngester,
  parseStudioJSON,
  parseSarifReport,
  computeFingerprint,
} from './gate-ingester.js';

export type { IngesterOptions } from './gate-ingester.js';

// ============================================================================
// Recipe Registry
// ============================================================================

export {
  FixRecipeRegistryImpl,
  createRecipeRegistry,
  createDefaultRegistry,
  defineRecipe,
  createInsertPatch,
  createReplacePatch,
  createDeletePatch,
  createWrapPatch,
} from './recipe-registry.js';

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
