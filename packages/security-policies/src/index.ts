// ============================================================================
// @isl-lang/security-policies - Public API
// ============================================================================

/**
 * @packageDocumentation
 * 
 * Security policy pack and lint rules for ISL specifications.
 * Enforces safe defaults for authentication, payments, webhooks, and data protection.
 * 
 * @example
 * ```typescript
 * import { 
 *   createSecurityChecker,
 *   checkSecurity,
 *   lint,
 *   createAutofixGenerator,
 * } from '@isl-lang/security-policies';
 * 
 * // Full security check (policies + lint)
 * const result = checkSecurity(domain);
 * console.log(result.passed ? 'Secure!' : 'Issues found');
 * 
 * // Just lint rules
 * const lintResult = lint(domain);
 * 
 * // Generate auto-fixes
 * const generator = createAutofixGenerator();
 * for (const finding of result.allFindings) {
 *   const fix = generator.generateEdits(finding, sourceText);
 *   if (fix) console.log(fix.preview);
 * }
 * ```
 */

// Main checker
export {
  SecurityPolicyChecker,
  createSecurityChecker,
  checkSecurity,
  checkPolicies,
} from './checker.js';

// Lint analyzer
export {
  SecurityLintAnalyzer,
  createLintAnalyzer,
  lint,
  AutofixGenerator,
  createAutofixGenerator,
  generateFix,
  applyAllFixes,
  type TextEdit,
  type AutofixResult,
} from './lint/index.js';

// Policy rules
export {
  allPolicyRules,
  getPoliciesByCategory,
  getPolicyById,
  piiProtectionPolicies,
  noPIILogsRule,
  noPIIExposureRule,
  secretsManagementPolicies,
  secretsAnnotationRule,
  secretsRedactionRule,
  secretsNotInOutputRule,
  webhookSecurityPolicies,
  webhookSignatureRequiredRule,
  webhookIdempotencyRule,
  webhookReplayProtectionRule,
  rateLimitingPolicies,
  authRateLimitRule,
  authRateLimitStrictnessRule,
  sensitiveRateLimitRule,
  anonymousRateLimitRule,
} from './policies/index.js';

// Lint rules
export {
  allLintRules,
  getLintRulesByCategory,
  getLintRuleById,
  authLintRules,
  authConstraintsRule,
  sessionSecurityRule,
  paymentLintRules,
  paymentConstraintsRule,
  paymentFraudCheckRule,
  pciComplianceRule,
  webhookLintRules,
  webhookConstraintsRule,
  webhookErrorHandlingRule,
  webhookResponseTimeRule,
} from './lint/index.js';

// Types
export type {
  // Core types
  Domain,
  Behavior,
  Entity,
  Field,
  Annotation,
  SecuritySpec,
  ObservabilitySpec,
  LogSpec,
  SourceLocation,
  ASTNode,
  
  // Finding types
  Finding,
  ASTFix,
  ASTPatch,
  Severity,
  PolicyCategory,
  
  // Rule types
  PolicyRule,
  LintRule,
  RuleContext,
  RequiredConstraint,
  
  // Result types
  PolicyCheckResult,
  LintResult,
  SecurityCheckResult,
  
  // Options
  SecurityPolicyOptions,
} from './types.js';

export {
  DEFAULT_SECURITY_OPTIONS,
  SEVERITY_PRIORITY,
} from './types.js';
