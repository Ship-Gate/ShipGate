/**
 * ISL Linter V2 - Type Definitions
 *
 * Types for lint diagnostics, rules, severity classification, and auto-fix suggestions.
 * This version introduces AST-based patches for automated fixes.
 */

import type { SourceLocation, ASTNode, Domain, Behavior, Expression, Field } from '@isl-lang/parser';

// ============================================================================
// Severity Classification
// ============================================================================

/**
 * Lint diagnostic severity levels
 * - error: Must be fixed, blocks deployment
 * - warning: Should be addressed, potential issues
 * - info: Informational, suggestions for improvement
 * - hint: Style or best practice suggestions
 */
export type LintSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Numeric severity levels for ordering
 */
export const SEVERITY_LEVEL: Record<LintSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

/**
 * Lint rule category for filtering and grouping
 */
export type LintCategory =
  | 'correctness' // Issues that are likely bugs
  | 'safety' // Security and safety issues
  | 'completeness' // Missing required elements
  | 'clarity' // Ambiguous or unclear specifications
  | 'best-practice' // Style and best practices
  | 'performance'; // Performance-related issues

// ============================================================================
// AST Patch Types (for Auto-Fix)
// ============================================================================

/**
 * Types of AST patches that can be applied
 */
export type ASTPatchType =
  | 'insert' // Insert new node
  | 'replace' // Replace existing node
  | 'remove' // Remove existing node
  | 'wrap' // Wrap node in another
  | 'modify'; // Modify node properties

/**
 * Base interface for all AST patches
 */
export interface ASTPatchBase {
  /** Type of patch operation */
  type: ASTPatchType;
  /** Target node path in the AST (e.g., 'behaviors[0].postconditions') */
  targetPath: string;
  /** Description of what this patch does */
  description: string;
}

/**
 * Insert a new node at a specific location
 */
export interface InsertPatch extends ASTPatchBase {
  type: 'insert';
  /** Position relative to target: before, after, first child, last child */
  position: 'before' | 'after' | 'first' | 'last' | 'at_index';
  /** Index for at_index position */
  index?: number;
  /** The node to insert */
  node: ASTNode;
}

/**
 * Replace an existing node
 */
export interface ReplacePatch extends ASTPatchBase {
  type: 'replace';
  /** The new node to replace with */
  newNode: ASTNode;
  /** Optional: preserve certain properties from old node */
  preserveProperties?: string[];
}

/**
 * Remove an existing node
 */
export interface RemovePatch extends ASTPatchBase {
  type: 'remove';
  /** If removing from array, the index */
  index?: number;
}

/**
 * Wrap a node in another node
 */
export interface WrapPatch extends ASTPatchBase {
  type: 'wrap';
  /** The wrapper node (target node becomes child) */
  wrapper: Partial<ASTNode>;
  /** Property name where target should be placed in wrapper */
  childProperty: string;
}

/**
 * Modify properties of an existing node
 */
export interface ModifyPatch extends ASTPatchBase {
  type: 'modify';
  /** Properties to set/update */
  properties: Record<string, unknown>;
}

/**
 * Union of all patch types
 */
export type ASTPatch = InsertPatch | ReplacePatch | RemovePatch | WrapPatch | ModifyPatch;

// ============================================================================
// Auto-Fix Suggestion
// ============================================================================

/**
 * A suggested fix for a lint diagnostic
 */
export interface LintFix {
  /** Unique identifier for this fix */
  id: string;

  /** Human-readable title for the fix */
  title: string;

  /** Detailed description of what the fix does */
  description: string;

  /** The patches to apply (in order) */
  patches: ASTPatch[];

  /** Is this fix safe to apply automatically? */
  isAutomaticallySafe: boolean;

  /** Priority: higher = more preferred fix */
  priority: number;

  /** Category of fix for grouping */
  category: 'add-constraint' | 'add-block' | 'modify-value' | 'remove-element' | 'restructure';
}

// ============================================================================
// Lint Diagnostics
// ============================================================================

/**
 * A single lint diagnostic with optional auto-fix
 */
export interface LintDiagnostic {
  /** Unique rule identifier (e.g., 'ISL2-001') */
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

  /** Suggested fixes (may have multiple alternatives) */
  fixes?: LintFix[];

  /** Related locations for context */
  relatedLocations?: RelatedLocation[];

  /** Additional metadata */
  meta?: Record<string, unknown>;

  /** Tags for filtering */
  tags?: string[];
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

  /** Total number of available fixes */
  fixableCount: number;

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
  /** Unique rule identifier (e.g., 'ISL2-001') */
  id: string;

  /** Human-readable rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Default severity */
  severity: LintSeverity;

  /** Rule category */
  category: LintCategory;

  /** Tags for filtering */
  tags?: string[];

  /** Rule implementation */
  check: LintRuleChecker;
}

/**
 * Function type for rule implementations
 */
export type LintRuleChecker = (context: LintContext) => LintDiagnostic[];

// ============================================================================
// Lint Context
// ============================================================================

/**
 * Context passed to lint rule checkers
 */
export interface LintContext {
  /** The domain AST being linted */
  domain: Domain;

  /** Rule configuration */
  config: LintRuleConfig;

  /** Helper to create a diagnostic */
  report: (params: DiagnosticParams) => LintDiagnostic;

  /** Get source location for an AST node */
  getLocation: (node: ASTNode) => SourceLocation;

  /** Create an AST patch */
  createPatch: PatchFactory;

  /** Create a fix from patches */
  createFix: FixFactory;
}

/**
 * Parameters for creating a diagnostic
 */
export interface DiagnosticParams {
  node: ASTNode;
  message: string;
  elementName?: string;
  fixes?: LintFix[];
  relatedLocations?: RelatedLocation[];
  meta?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Factory for creating AST patches
 */
export interface PatchFactory {
  insert(
    targetPath: string,
    node: ASTNode,
    position: InsertPatch['position'],
    description: string,
    index?: number
  ): InsertPatch;

  replace(
    targetPath: string,
    newNode: ASTNode,
    description: string,
    preserveProperties?: string[]
  ): ReplacePatch;

  remove(targetPath: string, description: string, index?: number): RemovePatch;

  modify(targetPath: string, properties: Record<string, unknown>, description: string): ModifyPatch;
}

/**
 * Factory for creating lint fixes
 */
export type FixFactory = (params: {
  id: string;
  title: string;
  description: string;
  patches: ASTPatch[];
  isAutomaticallySafe?: boolean;
  priority?: number;
  category?: LintFix['category'];
}) => LintFix;

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

  /** Include auto-fix suggestions */
  includeFixes?: boolean;

  /** Tags to filter rules by */
  includeTags?: string[];

  /** Tags to exclude */
  excludeTags?: string[];
}

// ============================================================================
// Apply Fix Result
// ============================================================================

/**
 * Result of applying a fix to an AST
 */
export interface ApplyFixResult {
  /** Whether the fix was successfully applied */
  success: boolean;

  /** The modified AST (if successful) */
  ast?: Domain;

  /** Error message (if failed) */
  error?: string;

  /** Patches that were applied */
  appliedPatches: ASTPatch[];

  /** Patches that failed */
  failedPatches: { patch: ASTPatch; reason: string }[];
}

// ============================================================================
// Security-Sensitive Patterns
// ============================================================================

/**
 * Patterns that indicate security-sensitive behaviors
 */
export const SECURITY_PATTERNS = {
  auth: [
    'auth',
    'authenticate',
    'login',
    'logout',
    'signin',
    'signout',
    'signup',
    'register',
    'password',
    'credential',
    'session',
    'token',
  ],
  payment: [
    'payment',
    'pay',
    'charge',
    'refund',
    'transfer',
    'withdraw',
    'deposit',
    'transaction',
    'billing',
    'invoice',
    'subscription',
    'checkout',
  ],
  upload: ['upload', 'download', 'export', 'import', 'file', 'attachment', 'media'],
  data: ['delete', 'remove', 'purge', 'archive', 'personal', 'pii', 'sensitive', 'secret', 'private'],
} as const;

/**
 * Minimum constraint requirements for sensitive behaviors
 */
export interface MinimumConstraints {
  category: keyof typeof SECURITY_PATTERNS;
  requiredBlocks: ('actors' | 'preconditions' | 'postconditions' | 'security')[];
  minPreconditions?: number;
  minPostconditions?: number;
  requiresRateLimit?: boolean;
  requiresFraudCheck?: boolean;
}

export const MINIMUM_CONSTRAINTS: MinimumConstraints[] = [
  {
    category: 'auth',
    requiredBlocks: ['preconditions', 'postconditions', 'security'],
    minPreconditions: 1,
    minPostconditions: 1,
    requiresRateLimit: true,
  },
  {
    category: 'payment',
    requiredBlocks: ['actors', 'preconditions', 'postconditions', 'security'],
    minPreconditions: 2,
    minPostconditions: 1,
    requiresFraudCheck: true,
  },
  {
    category: 'upload',
    requiredBlocks: ['actors', 'preconditions', 'postconditions'],
    minPreconditions: 1,
    minPostconditions: 1,
  },
  {
    category: 'data',
    requiredBlocks: ['actors', 'postconditions'],
    minPostconditions: 1,
  },
];
