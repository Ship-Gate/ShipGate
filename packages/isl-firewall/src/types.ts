/**
 * ISL Firewall - Type Definitions
 * 
 * @module @isl-lang/firewall
 */

// ============================================================================
// Firewall Mode
// ============================================================================

/**
 * Firewall operating mode
 * - observe: Log violations but don't block
 * - enforce: Block violations
 * - lockdown: Block all writes except to allowlisted paths
 */
export type FirewallMode = 'observe' | 'enforce' | 'lockdown';

// ============================================================================
// Confidence Tiers
// ============================================================================

/**
 * Confidence tier for violations
 * - hard_block: High confidence, always block in enforce mode
 * - soft_block: Medium confidence, block for agent-touched files
 * - warn: Low confidence, never block
 */
export type ConfidenceTier = 'hard_block' | 'soft_block' | 'warn';

// ============================================================================
// Claims
// ============================================================================

/**
 * Types of claims that can be extracted from code
 */
export type ClaimType =
  | 'import'
  | 'function_call'
  | 'type_reference'
  | 'api_endpoint'
  | 'env_variable'
  | 'file_reference'
  | 'package_dependency';

/**
 * A verifiable claim extracted from code
 */
export interface Claim {
  /** Unique claim ID */
  id: string;
  /** Type of claim */
  type: ClaimType;
  /** The claimed value */
  value: string;
  /** Location in source */
  location: {
    line: number;
    column: number;
    length: number;
  };
  /** Confidence in extraction (0-1) */
  confidence: number;
  /** Surrounding context */
  context: string;
}

// ============================================================================
// Evidence
// ============================================================================

/**
 * Source of evidence for a claim
 */
export type EvidenceSource = 'truthpack' | 'filesystem' | 'package_json' | 'ast';

/**
 * Evidence for or against a claim
 */
export interface Evidence {
  /** ID of the claim this evidence is for */
  claimId: string;
  /** Whether evidence was found */
  found: boolean;
  /** Source of the evidence */
  source: EvidenceSource;
  /** Location where evidence was found */
  location?: {
    file: string;
    line?: number;
  };
  /** Confidence in the evidence (0-1) */
  confidence: number;
  /** Additional details */
  details: Record<string, unknown>;
}

// ============================================================================
// Policy
// ============================================================================

/**
 * A firewall policy rule
 */
export interface Policy {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Description */
  description: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Confidence tier */
  tier: ConfidenceTier;
  /** Claim types this rule applies to */
  appliesTo: ClaimType[];
  /** Evaluate the rule */
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null;
}

/**
 * A policy violation
 */
export interface PolicyViolation {
  /** Policy ID that was violated */
  policyId: string;
  /** Claim that violated the policy */
  claimId: string;
  /** Human-readable message */
  message: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Confidence tier */
  tier: ConfidenceTier;
  /** Suggestion for fixing */
  suggestion?: string;
  /** Quick fixes */
  quickFixes?: QuickFix[];
}

/**
 * Quick fix that can be applied
 */
export interface QuickFix {
  /** Type of fix */
  type: 'replace' | 'add' | 'remove' | 'allow_pattern';
  /** Label for the fix */
  label: string;
  /** Value to apply */
  value: string;
  /** Original value */
  original?: string;
}

/**
 * Policy evaluation decision
 */
export interface PolicyDecision {
  /** Whether to allow the operation */
  allowed: boolean;
  /** Violations found */
  violations: PolicyViolation[];
  /** Summary message */
  message: string;
}

// ============================================================================
// Firewall Result
// ============================================================================

/**
 * Result of a firewall evaluation
 */
export interface FirewallResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Firewall mode at time of evaluation */
  mode: FirewallMode;
  /** Claims extracted from content */
  claims: Claim[];
  /** Evidence resolved for claims */
  evidence: Evidence[];
  /** Policy violations */
  violations: PolicyViolation[];
  /** Summary statistics */
  stats: {
    claimsExtracted: number;
    evidenceFound: number;
    evidenceMissing: number;
    violationsTotal: number;
    hardBlocks: number;
    softBlocks: number;
    warnings: number;
  };
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Request for firewall evaluation
 */
export interface FirewallRequest {
  /** Content to evaluate */
  content: string;
  /** File path */
  filePath: string;
  /** Whether file was touched by AI agent */
  agentTouched?: boolean;
  /** Intent/purpose of the change */
  intent?: string;
}

// ============================================================================
// Allowlist
// ============================================================================

/**
 * Firewall allowlist configuration
 */
export interface FirewallAllowlist {
  /** Route prefixes always allowed */
  allowedRoutePrefixes: string[];
  /** Dynamic route patterns (regex) */
  allowedDynamicRoutes: string[];
  /** Paths to ignore (glob patterns) */
  ignoredPaths: string[];
  /** Environment variables allowed without declaration */
  allowedEnvVars: string[];
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Firewall configuration
 */
export interface FirewallConfig {
  /** Operating mode */
  mode: FirewallMode;
  /** Project root */
  projectRoot: string;
  /** Truthpack path (relative to project root) */
  truthpackPath: string;
  /** Policies to enable */
  policies: string[];
  /** Timeout for operations */
  timeout: number;
  /** Enable caching */
  enableCaching: boolean;
}

export const DEFAULT_FIREWALL_CONFIG: FirewallConfig = {
  mode: 'observe',
  projectRoot: process.cwd(),
  truthpackPath: '.shipgate/truthpack',
  policies: ['ghost-route', 'ghost-env', 'ghost-import', 'ghost-file'],
  timeout: 5000,
  enableCaching: true,
};
