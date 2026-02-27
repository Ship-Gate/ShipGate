/**
 * ISL Repair Engine - Type Definitions
 *
 * Types for the deterministic AST repair system that fixes common
 * structural and schema issues in ISL ASTs.
 */

import type { ASTNode, Domain, SourceLocation } from '@isl-lang/parser';

// ============================================================================
// REPAIR TYPES
// ============================================================================

/**
 * Confidence level for a repair operation
 * - high: Unambiguous fix (e.g., adding required empty array)
 * - medium: Likely correct fix (e.g., normalizing field order)
 * - low: Best-effort fix that may need manual review
 */
export type RepairConfidence = 'high' | 'medium' | 'low';

/**
 * Category of repair operation
 */
export type RepairCategory =
  | 'missing-field'      // Required field was missing
  | 'normalize-order'    // Array/field ordering normalized
  | 'schema-mismatch'    // Type or schema structure fixed
  | 'invalid-value'      // Value corrected to valid form
  | 'duplicate-removal'  // Duplicate entries removed
  | 'location-fix';      // Source location repaired

/**
 * Description of a single repair operation performed
 */
export interface Repair {
  /** Unique identifier for this repair */
  id: string;

  /** Category of the repair */
  category: RepairCategory;

  /** JSON path to the repaired node (e.g., "domain.entities[0].fields") */
  path: string;

  /** Human-readable reason for the repair */
  reason: string;

  /** Summary of what changed */
  diffSummary: string;

  /** Original value before repair (if applicable) */
  originalValue?: unknown;

  /** New value after repair */
  repairedValue?: unknown;

  /** Confidence level of this repair */
  confidence: RepairConfidence;

  /** Source location of the affected node */
  location?: SourceLocation;

  /** Related error codes that this repair addresses */
  relatedErrorCodes?: string[];
}

/**
 * Error that could not be repaired
 */
export interface UnrepairedError {
  /** Original error code */
  code?: string;

  /** Error message */
  message: string;

  /** JSON path to the error location */
  path: string;

  /** Why this error could not be repaired */
  reason: string;

  /** Source location */
  location?: SourceLocation;
}

/**
 * Input validation error format (compatible with multiple error sources)
 */
export interface ValidationError {
  /** Error code (e.g., "E0100") */
  code?: string;

  /** Error message */
  message: string;

  /** JSON path or description of error location */
  path?: string;

  /** Severity level */
  severity?: 'error' | 'warning' | 'info';

  /** Source location in the original file */
  location?: SourceLocation;
}

/**
 * Result of the repair operation
 */
export interface RepairResult {
  /** The repaired AST (deep clone, original is not mutated) */
  ast: Domain;

  /** List of repairs that were performed */
  repairs: Repair[];

  /** Errors that could not be automatically repaired */
  remainingErrors: UnrepairedError[];

  /** Overall repair statistics */
  stats: RepairStats;
}

/**
 * Statistics about the repair operation
 */
export interface RepairStats {
  /** Total number of repairs performed */
  totalRepairs: number;

  /** Repairs by category */
  byCategory: Record<RepairCategory, number>;

  /** Repairs by confidence level */
  byConfidence: Record<RepairConfidence, number>;

  /** Number of errors that could not be repaired */
  unrepairedCount: number;

  /** Duration of repair operation in milliseconds */
  durationMs: number;
}

// ============================================================================
// REPAIR STRATEGY TYPES
// ============================================================================

/**
 * Context provided to repair strategies
 */
export interface RepairContext {
  /** The current AST being repaired */
  ast: Domain;

  /** All validation errors to consider */
  errors: ValidationError[];

  /** Repairs performed so far */
  repairs: Repair[];

  /** Current JSON path being processed */
  currentPath: string;

  /** Generate a unique repair ID */
  generateId: () => string;
}

/**
 * A repair strategy that can fix specific types of issues
 */
export interface RepairStrategy {
  /** Unique name for this strategy */
  name: string;

  /** Description of what this strategy repairs */
  description: string;

  /** Categories this strategy handles */
  categories: RepairCategory[];

  /**
   * Apply repairs to the AST
   * Returns repairs made and any errors that couldn't be fixed
   */
  apply(ctx: RepairContext): RepairStrategyResult;
}

/**
 * Result from a repair strategy
 */
export interface RepairStrategyResult {
  /** Repairs performed by this strategy */
  repairs: Repair[];

  /** Errors that this strategy couldn't repair */
  unrepaired: UnrepairedError[];
}

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Options for the repair operation
 */
export interface RepairOptions {
  /** Minimum confidence level to apply repairs (default: 'low') */
  minConfidence?: RepairConfidence;

  /** Categories of repairs to apply (default: all) */
  categories?: RepairCategory[];

  /** Whether to normalize ordering even without errors (default: true) */
  normalizeOrdering?: boolean;

  /** Whether to add missing optional fields with defaults (default: false) */
  addOptionalDefaults?: boolean;

  /** Maximum number of repairs to perform (default: unlimited) */
  maxRepairs?: number;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Deep partial type for AST nodes
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Type guard result
 */
export interface TypeGuardResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}
