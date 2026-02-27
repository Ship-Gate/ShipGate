/**
 * ISL Semantic Linter - Type Definitions
 * 
 * Types for lint diagnostics, rules, and results.
 */

import type { SourceLocation, ASTNode } from '@isl-lang/parser';

// ============================================================================
// Severity Levels
// ============================================================================

/**
 * Lint diagnostic severity
 */
export type LintSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Lint rule category for filtering and grouping
 */
export type LintCategory =
  | 'correctness'     // Issues that are likely bugs
  | 'safety'          // Security and safety issues
  | 'completeness'    // Missing required elements
  | 'clarity'         // Ambiguous or unclear specifications
  | 'best-practice';  // Style and best practices

// ============================================================================
// Lint Diagnostics
// ============================================================================

/**
 * A single lint diagnostic
 */
export interface LintDiagnostic {
  /** Unique rule identifier (e.g., 'ISL001') */
  ruleId: string;
  
  /** Human-readable rule name */
  ruleName: string;
  
  /** Diagnostic severity */
  severity: LintSeverity;
  
  /** Diagnostic category */
  category: LintCategory;
  
  /** Human-readable message describing the issue */
  message: string;
  
  /** Source location of the issue */
  location: SourceLocation;
  
  /** Name of the affected element (behavior, entity, etc.) */
  elementName?: string;
  
  /** Suggested fix or action */
  suggestion?: string;
  
  /** Related locations for context */
  relatedLocations?: RelatedLocation[];
  
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * A related source location with description
 */
export interface RelatedLocation {
  location: SourceLocation;
  message: string;
}

// ============================================================================
// Lint Results
// ============================================================================

/**
 * Result of linting a domain
 */
export interface LintResult {
  /** Whether the lint passed (no errors) */
  success: boolean;
  
  /** All diagnostics found */
  diagnostics: LintDiagnostic[];
  
  /** Count by severity */
  counts: {
    error: number;
    warning: number;
    info: number;
    hint: number;
  };
  
  /** Domain name that was linted */
  domainName?: string;
  
  /** Duration of lint in milliseconds */
  durationMs?: number;
  
  /** Rules that were skipped or disabled */
  skippedRules?: string[];
}

// ============================================================================
// Lint Rules
// ============================================================================

/**
 * Configuration for a lint rule
 */
export interface LintRuleConfig {
  /** Whether the rule is enabled */
  enabled: boolean;
  
  /** Override severity (uses rule default if not specified) */
  severity?: LintSeverity;
  
  /** Rule-specific options */
  options?: Record<string, unknown>;
}

/**
 * A lint rule definition
 */
export interface LintRule {
  /** Unique rule identifier (e.g., 'ISL001') */
  id: string;
  
  /** Human-readable rule name */
  name: string;
  
  /** Rule description */
  description: string;
  
  /** Default severity */
  severity: LintSeverity;
  
  /** Rule category */
  category: LintCategory;
  
  /** Rule implementation */
  check: LintRuleChecker;
}

/**
 * Function type for rule implementations
 */
export type LintRuleChecker = (
  context: LintContext
) => LintDiagnostic[];

// ============================================================================
// Lint Context
// ============================================================================

/**
 * Context passed to lint rule checkers
 */
export interface LintContext {
  /** The domain AST being linted */
  domain: import('@isl-lang/parser').Domain;
  
  /** Rule configuration */
  config: LintRuleConfig;
  
  /** Helper to create a diagnostic */
  report: (params: DiagnosticParams) => LintDiagnostic;
  
  /** Get source location for an AST node */
  getLocation: (node: ASTNode) => SourceLocation;
}

/**
 * Parameters for creating a diagnostic
 */
export interface DiagnosticParams {
  node: ASTNode;
  message: string;
  elementName?: string;
  suggestion?: string;
  relatedLocations?: RelatedLocation[];
  meta?: Record<string, unknown>;
}

// ============================================================================
// Lint Options
// ============================================================================

/**
 * Options for the lint function
 */
export interface LintOptions {
  /** Rule configurations (keyed by rule ID) */
  rules?: Record<string, LintRuleConfig | boolean>;
  
  /** Categories to include (all if not specified) */
  includeCategories?: LintCategory[];
  
  /** Categories to exclude */
  excludeCategories?: LintCategory[];
  
  /** Minimum severity to report */
  minSeverity?: LintSeverity;
  
  /** Stop on first error */
  failFast?: boolean;
}

// ============================================================================
// Security-Sensitive Patterns
// ============================================================================

/**
 * Patterns that indicate security-sensitive behaviors
 */
export const SECURITY_SENSITIVE_PATTERNS = [
  // Authentication
  'auth', 'authenticate', 'login', 'logout', 'signin', 'signout',
  'signup', 'register', 'password', 'credential',
  // Authorization
  'authorize', 'permission', 'role', 'access', 'grant', 'revoke',
  // Payments
  'payment', 'pay', 'charge', 'refund', 'transfer', 'withdraw',
  'deposit', 'transaction', 'billing', 'invoice', 'subscription',
  // Data handling
  'upload', 'download', 'export', 'import', 'delete', 'remove',
  'purge', 'archive',
  // Sensitive data
  'personal', 'pii', 'sensitive', 'secret', 'private', 'confidential',
  // Tokens & keys
  'token', 'apikey', 'api_key', 'secret_key', 'access_token',
] as const;

/**
 * Critical behavior name patterns that require postconditions
 */
export const CRITICAL_BEHAVIOR_PATTERNS = [
  'create', 'update', 'delete', 'remove',
  'transfer', 'send', 'assign', 'change',
  'approve', 'reject', 'cancel', 'confirm',
] as const;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Numeric comparison operators
 */
export type ComparisonOperator = '==' | '!=' | '<' | '>' | '<=' | '>=';

/**
 * Pattern for detecting impossible constraints
 */
export interface ImpossiblePattern {
  /** Description of the impossible pattern */
  description: string;
  /** Check if a constraint matches this pattern */
  check: (left: unknown, op: string, right: unknown) => boolean;
}
