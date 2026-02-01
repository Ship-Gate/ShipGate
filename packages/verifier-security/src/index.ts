// ============================================================================
// Security Verifier - Public API
// ============================================================================

/**
 * @packageDocumentation
 * 
 * Security property verification for ISL specifications.
 * 
 * Checks for:
 * - Authentication vulnerabilities
 * - Authorization issues
 * - Injection risks (SQL, XSS, Command)
 * - Data exposure problems
 * - Cryptography weaknesses
 * 
 * @example
 * ```typescript
 * import { createSecurityVerifier } from '@intentos/verifier-security';
 * 
 * const verifier = createSecurityVerifier({
 *   categories: ['authentication', 'injection'],
 *   failOnSeverity: 'high',
 * });
 * 
 * const result = verifier.verify(domain);
 * console.log(verifier.generateReport(result));
 * ```
 */

export { SecurityVerifier, createSecurityVerifier, verifySecurityAsync } from './verifier.js';

export type {
  SecurityCategory,
  Severity,
  SecurityFinding,
  SecurityVerificationResult,
  SecurityVerifierOptions,
  SecurityRule,
  RuleContext,
  Domain,
  Behavior,
  Entity,
} from './types.js';

export { DEFAULT_OPTIONS, SEVERITY_PRIORITY } from './types.js';

// Rules
export { authenticationRules } from './rules/authentication.js';
export { injectionRules } from './rules/injection.js';
export { dataExposureRules } from './rules/data-exposure.js';
