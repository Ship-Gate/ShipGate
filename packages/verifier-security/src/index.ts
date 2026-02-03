/**
 * @isl-lang/verifier-security
 *
 * Security verifier for detecting timing attacks, insecure comparisons,
 * token entropy issues, and other security vulnerabilities.
 *
 * @module @isl-lang/verifier-security
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  SecuritySeverity,
  SecurityViolation,
  SecurityRuleConfig,
  SecurityRule,
  
  // Token source types
  ApprovedTokenSource,
  TokenSourceCheckResult,
  
  // Runtime types
  SecurityTraceEvent,
  SafeTokenMetadata,
  RuntimeTokenCheckResult,
  
  // Verification result types
  SecurityVerdict,
  SecurityVerifyResult,
  SecurityCoverageInfo,
  SecurityTimingInfo,
  
  // Clause types
  SecurityClause,
  ClauseEvaluationResult,
  
  // ISL domain analysis types
  SecurityFinding,
  RuleContext,
  Domain,
  Behavior,
  Entity,
  FieldDefinition,
  DomainSecurityRule,
  // Aliases
  DomainDefinition,
  BehaviorDefinition,
  EntityDefinition,
} from './types.js';

// ============================================================================
// Verifier Exports
// ============================================================================

export {
  SecurityVerifier,
  createVerifier,
  verify,
  verifyStatic,
  verifyRuntime,
  verifyFile,
  verifySecurityClauses,
  create256BitEntropyClause,
  create64CharLengthClause,
  generateSafeReport,
  type VerifyOptions,
} from './verifier.js';

// ============================================================================
// Static Rules Exports
// ============================================================================

export {
  SECURITY_RULES,
  TOKEN_RULES,
  TIMING_RULES,
  LOGIN_INVARIANT_RULES,
  APPROVED_CONSTANT_TIME_HELPERS,
  runSecurityRules,
  runSecurityRule,
  getSecurityRuleIds,
  isTokenGenerationSecure,
} from './static-rules.js';

// ============================================================================
// Approved Sources Exports
// ============================================================================

export {
  APPROVED_TOKEN_SOURCES,
  INSECURE_PATTERNS,
  checkTokenSource,
  MIN_HEX_LENGTH_FOR_256_BIT,
  MIN_BASE64_LENGTH_FOR_256_BIT,
} from './approved-sources.js';

// ============================================================================
// Runtime Checks Exports
// ============================================================================

export {
  verifyAllTraceEvents,
  evaluateSecurityClause,
  createStandardSecurityClauses,
  createSafeLogEntry,
  assertNoTokenValue,
} from './runtime-checks.js';

// ============================================================================
// Reporter Exports
// ============================================================================

export {
  generateReport,
  toInvariantClauseResults,
  formatInvariantClause,
  type ReportFormat,
  type ReportOptions,
  type InvariantClauseResult,
} from './reporter.js';

// ============================================================================
// Domain Rules Exports
// ============================================================================

export { authenticationRules } from './rules/authentication.js';
export { dataExposureRules } from './rules/data-exposure.js';
export { injectionRules } from './rules/injection.js';
export { loginInvariantRules } from './rules/login-invariants.js';
