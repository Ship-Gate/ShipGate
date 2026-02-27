/**
 * Verification Security Scanner Types
 *
 * Types for pipeline-integrated security checks.
 * Each check returns { check, severity, passed, findings }.
 */

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityFinding {
  /** Unique finding ID */
  id: string;
  /** Human-readable title */
  title: string;
  /** Severity level */
  severity: SecuritySeverity;
  /** File path where finding was detected */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column (1-based, optional) */
  column?: number;
  /** Description of the vulnerability */
  description: string;
  /** Remediation suggestion */
  recommendation: string;
  /** Matched code snippet (optional) */
  snippet?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface SecurityCheckResult {
  /** Check identifier */
  check: string;
  /** Severity of the check category */
  severity: SecuritySeverity;
  /** True if no critical/high findings */
  passed: boolean;
  /** Individual findings */
  findings: SecurityFinding[];
}

export interface VerificationSecurityScanOptions {
  /** Root directory to scan (default: process.cwd()) */
  rootDir?: string;
  /** ISL spec source (for auth-bypass check) */
  islSource?: string;
  /** Path to ISL spec file */
  islSpecPath?: string;
  /** Paths to implementation files (default: auto-discover) */
  implPaths?: string[];
  /** Path to package.json for dependency audit */
  packageJsonPath?: string;
  /** Skip dependency audit (e.g. when npm not available) */
  skipDependencyAudit?: boolean;
}

export interface VerificationSecurityScanResult {
  /** Timestamp */
  timestamp: string;
  /** Total duration in ms */
  durationMs: number;
  /** Individual check results */
  checks: SecurityCheckResult[];
  /** Whether any critical/high findings exist (→ NO_SHIP) */
  hasBlockingFindings: boolean;
  /** Whether any medium/low findings exist (→ warnings only) */
  hasWarnings: boolean;
  /** Summary counts */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}
