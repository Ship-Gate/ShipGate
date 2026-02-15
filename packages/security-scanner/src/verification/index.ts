/**
 * Verification Security Scanner
 *
 * Pipeline-integrated security checks for ISL verification.
 * Each check returns { check, severity, passed, findings }.
 */

export {
  VerificationSecurityScanner,
  runVerificationSecurityScan,
} from './verification-scanner.js';
export type {
  VerificationSecurityScanOptions,
  VerificationSecurityScanResult,
} from './verification-scanner.js';

export type {
  SecurityCheckResult,
  SecurityFinding,
  SecuritySeverity,
} from './types.js';

export { runSqlInjectionCheck } from './checks/sql-injection.js';
export { runAuthBypassCheck } from './checks/auth-bypass.js';
export { runSecretExposureCheck } from './checks/secret-exposure.js';
export { runXssCheck } from './checks/xss.js';
export { runSsrfCheck } from './checks/ssrf.js';
export { runDependencyAuditCheck } from './checks/dependency-audit.js';
export { runOwaspHeadersCheck } from './checks/owasp-headers.js';
