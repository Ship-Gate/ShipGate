/**
 * ISL Policy Packs - Pre-built security policies
 * 
 * @module @isl-lang/policy-packs
 * 
 * @example
 * ```typescript
 * import { registry, loadBuiltinPacks } from '@isl-lang/policy-packs';
 * 
 * // Load all built-in packs
 * await loadBuiltinPacks(registry);
 * 
 * // Get all enabled rules
 * const rules = registry.getEnabledRules();
 * 
 * // Or import specific packs
 * import { authPolicyPack } from '@isl-lang/policy-packs/auth';
 * import { paymentsPolicyPack } from '@isl-lang/policy-packs/payments';
 * ```
 */

// Types
export type {
  PolicySeverity,
  PolicyRule,
  RuleContext,
  RuleViolation,
  PolicyPack,
  PolicyPackConfig,
  PolicyPackRegistry,
  TruthpackData,
  RouteDefinition,
  EnvDefinition,
  AuthDefinition,
  ContractDefinition,
} from './types.js';

// Registry
export { registry, createRegistry, loadBuiltinPacks } from './registry.js';

// Utilities
export {
  findClaimsByType,
  hasEvidence,
  getUnverifiedClaims,
  matchesAnyPattern,
  containsKeyword,
  getLineNumber,
  routeRequiresAuth,
  isProtectedPath,
  isPublicPath,
  isSensitiveEnv,
} from './utils.js';

// Rule Explanations
export {
  explainRule,
  getAllExplanations,
  formatExplanationMarkdown,
  formatExplanationTerminal,
  type RuleExplanation,
  type FixPattern,
  type CodeExample,
} from './explain.js';

// Policy Packs
export { authPolicyPack } from './packs/auth.js';
export { paymentsPolicyPack } from './packs/payments.js';
export { piiPolicyPack } from './packs/pii.js';
export { rateLimitPolicyPack } from './packs/rate-limit.js';

/**
 * All built-in policy packs
 */
export const builtinPacks = [
  'auth',
  'payments',
  'pii',
  'rate-limit',
] as const;

export type BuiltinPackId = typeof builtinPacks[number];
