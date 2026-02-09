/**
 * Types for Security Verifier Enhancer
 * Detects auth drift between ISL specs and implementations
 */

/**
 * Auth requirement extracted from ISL spec
 */
export interface ISLAuthRequirement {
  /** Behavior name */
  behaviorName: string;
  /** Route path (if mapped) */
  routePath?: string;
  /** HTTP method (if mapped) */
  httpMethod?: string;
  /** Auth requirement type */
  requirementType: 'auth' | 'role' | 'permission' | 'public';
  /** Required role(s) */
  requiredRoles?: string[];
  /** Required permission(s) */
  requiredPermissions?: string[];
  /** ISL file path */
  islFilePath: string;
  /** Line number in ISL file */
  line: number;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Observed auth enforcement from implementation
 */
export interface ObservedAuthPolicy {
  /** Route path */
  routePath: string;
  /** HTTP method */
  httpMethod: string;
  /** Implementation file path */
  filePath: string;
  /** Line number */
  line: number;
  /** Auth enforcement type */
  enforcementType: 'middleware' | 'guard' | 'decorator' | 'manual-check' | 'none';
  /** Detected roles */
  detectedRoles?: string[];
  /** Detected permissions */
  detectedPermissions?: string[];
  /** Auth patterns found */
  authPatterns: string[];
  /** Confidence level (0-1) */
  confidence: number;
  /** Code snippet */
  snippet?: string;
}

/**
 * Auth drift claim
 */
export interface AuthDriftClaim {
  /** Unique claim ID */
  id: string;
  /** Route path */
  route: string;
  /** HTTP method */
  method: string;
  /** Expected policy from ISL */
  expectedPolicy: ISLAuthRequirement;
  /** Observed policy from implementation */
  observedPolicy: ObservedAuthPolicy;
  /** Drift type */
  driftType: 'missing-auth' | 'extra-auth' | 'role-mismatch' | 'permission-mismatch' | 'none';
  /** Severity */
  severity: 'critical' | 'warning' | 'info';
  /** Confidence level (0-1) */
  confidence: number;
  /** Description */
  description: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Detection result
 */
export interface AuthDriftResult {
  /** All claims */
  claims: AuthDriftClaim[];
  /** Claims by severity */
  claimsBySeverity: {
    critical: AuthDriftClaim[];
    warning: AuthDriftClaim[];
    info: AuthDriftClaim[];
  };
  /** Summary statistics */
  summary: {
    totalClaims: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    routesChecked: number;
    routesWithDrift: number;
  };
}

/**
 * Configuration options
 */
export interface AuthDriftConfig {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Public endpoint confidence threshold (higher = less likely to flag public endpoints) */
  publicEndpointThreshold?: number;
  /** Include code snippets */
  includeSnippets?: boolean;
  /** Directories to ignore */
  ignoreDirs?: string[];
  /** File extensions to scan */
  includeExtensions?: string[];
}
