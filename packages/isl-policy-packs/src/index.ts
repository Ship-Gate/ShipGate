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
  TraceEntry,
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

// Bundle Format
export {
  createBundle,
  validateBundle,
  serializeBundle,
  deserializeBundle,
  checkBundleCompatibility,
  BUNDLE_FORMAT_VERSION,
  type PolicyBundle,
  type PolicyBundleMetadata,
  type PackVersionSpec,
  type BundleValidationResult,
  type DeprecationNotice,
} from './bundle.js';

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
export { qualityPolicyPack, DEFAULT_STUB_ALLOWLIST, isAllowedStubFile } from './packs/quality.js';
export { 
  securityPolicyPack, 
  securityRules,
  LOGGING_PATTERNS,
  PASSWORD_KEYWORDS,
  DIRECT_PASSWORD_PATTERNS,
  TRACE_PASSWORD_PATTERNS,
  REDACTED_MARKERS,
} from './packs/security.js';

/**
 * All built-in policy packs
 */
export const builtinPacks = [
  'auth',
  'payments',
  'pii',
  'rate-limit',
  'quality',
  'security',
] as const;

export type BuiltinPackId = typeof builtinPacks[number];
