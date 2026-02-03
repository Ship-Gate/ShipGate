// ============================================================================
// ISL Expression Evaluator - Type Definitions
// ============================================================================
// v1 - Complete Expression Evaluator for Postconditions/Invariants
// ============================================================================

import type { Expression, SourceLocation } from '@isl-lang/parser';

// ============================================================================
// TRI-STATE LOGIC
// ============================================================================

/**
 * Tri-state result: true, false, or unknown
 * Used when evaluating expressions against runtime traces or symbolic values
 *
 * Design rationale:
 * - 'true' and 'false' are definite results
 * - 'unknown' represents insufficient information to determine truth
 * - In strict mode, 'unknown' is treated as 'false' (fail-closed)
 */
export type TriState = 'true' | 'false' | 'unknown';

/**
 * Branded type for values that may be unknown
 * Use this when a function can return either a concrete value or 'unknown'
 */
export type MaybeUnknown<T> = T | 'unknown';

/**
 * Convert tri-state to boolean (unknown -> false for strict checks)
 */
export function triStateToBoolean(tri: TriState, strict: boolean = false): boolean {
  if (tri === 'unknown') {
    return !strict; // unknown is false in strict mode, true in lenient
  }
  return tri === 'true';
}

/**
 * Combine tri-states with AND logic
 */
export function triStateAnd(a: TriState, b: TriState): TriState {
  if (a === 'false' || b === 'false') return 'false';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'true';
}

/**
 * Combine tri-states with OR logic
 */
export function triStateOr(a: TriState, b: TriState): TriState {
  if (a === 'true' || b === 'true') return 'true';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'false';
}

/**
 * Negate tri-state
 */
export function triStateNot(a: TriState): TriState {
  if (a === 'true') return 'false';
  if (a === 'false') return 'true';
  return 'unknown';
}

/**
 * Implication: a implies b
 */
export function triStateImplies(a: TriState, b: TriState): TriState {
  // false implies anything is true
  if (a === 'false') return 'true';
  // true implies unknown is unknown
  if (a === 'true' && b === 'unknown') return 'unknown';
  // true implies true is true, true implies false is false
  if (a === 'true') return b;
  // unknown implies anything is unknown
  return 'unknown';
}

// ============================================================================
// VALUE TYPES
// ============================================================================

/**
 * Represents a runtime value in the evaluator
 * Can be any JavaScript value or the special 'unknown' marker
 */
export type Value = 
  | string
  | number
  | boolean
  | null
  | undefined
  | Value[]
  | { [key: string]: Value }
  | 'unknown';

/**
 * Check if a value is the 'unknown' marker
 */
export function isUnknown(value: unknown): value is 'unknown' {
  return value === 'unknown';
}

/**
 * Wrap a value that might be unknown
 */
export function wrapValue(value: unknown): Value {
  if (value === 'unknown') return 'unknown';
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(wrapValue);
  if (typeof value === 'object') {
    const result: { [key: string]: Value } = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = wrapValue(v);
    }
    return result;
  }
  return 'unknown';
}

// ============================================================================
// PROVENANCE TRACKING
// ============================================================================

/**
 * Source of a value in the evaluation
 */
export type ProvenanceSource = 
  | 'literal'     // Literal value in expression
  | 'variable'    // Variable from context
  | 'input'       // Input parameter
  | 'result'      // Result value (postconditions)
  | 'old_state'   // Old state snapshot
  | 'computed'    // Computed from sub-expressions
  | 'adapter'     // Retrieved via adapter
  | 'builtin';    // Built-in function result

/**
 * Tracks how a value was derived during evaluation
 * Enables debugging and explains why unknown was returned
 */
export interface Provenance {
  /** How this value was obtained */
  source: ProvenanceSource;
  /** Variable/property name if applicable */
  binding?: string;
  /** Adapter method called if applicable */
  adapterCall?: string;
  /** Built-in function called if applicable */
  builtinCall?: string;
  /** Why this evaluated to unknown (if applicable) */
  unknownReason?: string;
  /** Provenance of sub-expressions */
  children?: Provenance[];
}

// ============================================================================
// EVALUATION RESULT
// ============================================================================

/**
 * Rich evaluation result with diagnostics and provenance
 */
export interface EvaluationResult {
  /** Tri-state result */
  value: TriState;
  /** Source location of the expression */
  location: SourceLocation;
  /** Why the evaluation succeeded/failed/unknown */
  reason?: string;
  /** Detailed provenance tracking */
  provenance?: Provenance;
  /** Nested diagnostics for sub-expressions */
  diagnostics?: Diagnostic[];
  /** Performance metrics */
  metrics?: {
    evaluationTime: number;
    subExpressionCount: number;
  };
}

/**
 * Diagnostic information for expression evaluation
 */
export interface Diagnostic {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Diagnostic message */
  message: string;
  /** Source location */
  location: SourceLocation;
  /** Related expression */
  expression?: Expression;
  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Adapter for domain primitives (User.lookup, User.exists, etc.)
 * Allows plugging in domain-specific implementations
 *
 * All methods must be:
 * - Deterministic: Same inputs → same outputs
 * - Synchronous: No async/await, no network calls
 * - Side-effect free: No mutations, no I/O
 */
export interface ExpressionAdapter {
  /**
   * Check if a value is valid (non-null, non-empty)
   * @param value The value to check
   * @returns Tri-state result
   *
   * Default behavior:
   * - null/undefined → 'false'
   * - empty string → 'false'
   * - empty array → 'false'
   * - other values → 'true'
   */
  is_valid(value: unknown): TriState;

  /**
   * Get the length of a value
   * @param value The value (string, array, etc.)
   * @returns Length or 'unknown' if not applicable
   *
   * Default behavior:
   * - string → string.length
   * - array → array.length
   * - other → 'unknown'
   */
  length(value: unknown): number | 'unknown';

  /**
   * Check if an entity exists in the domain
   * @param entityName Entity type name (e.g., "User", "Order")
   * @param criteria Search criteria (e.g., { id: "123" })
   * @returns Tri-state result
   *
   * Default behavior: Returns 'unknown' (requires domain-specific impl)
   */
  exists(entityName: string, criteria?: Record<string, unknown>): TriState;

  /**
   * Lookup an entity in the domain
   * @param entityName Entity type name
   * @param criteria Search criteria
   * @returns Entity value, or 'unknown' if cannot determine
   *
   * Default behavior: Returns 'unknown' (requires domain-specific impl)
   */
  lookup(entityName: string, criteria?: Record<string, unknown>): unknown | 'unknown';

  /**
   * Get a property from an object
   * @param object The object
   * @param property Property name
   * @returns Property value or 'unknown' if not found
   */
  getProperty(object: unknown, property: string): unknown | 'unknown';

  /**
   * Test if a string matches a regular expression pattern
   * @param value The string to test
   * @param pattern The regex pattern
   * @returns Tri-state result
   *
   * Default behavior:
   * - Invalid pattern → 'unknown'
   * - Non-string value → 'unknown'
   * - Match → 'true'
   * - No match → 'false'
   */
  regex(value: unknown, pattern: string): TriState;
}

/**
 * Default adapter implementation
 * Provides sensible defaults for built-in functions
 */
export class DefaultAdapter implements ExpressionAdapter {
  is_valid(value: unknown): TriState {
    if (value === 'unknown') return 'unknown';
    if (value === null || value === undefined) return 'false';
    if (typeof value === 'string') return value.length > 0 ? 'true' : 'false';
    if (Array.isArray(value)) return value.length > 0 ? 'true' : 'false';
    return 'true';
  }

  length(value: unknown): number | 'unknown' {
    if (value === 'unknown') return 'unknown';
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    return 'unknown';
  }

  exists(_entityName: string, _criteria?: Record<string, unknown>): TriState {
    // Default: unknown (requires domain-specific implementation)
    return 'unknown';
  }

  lookup(_entityName: string, _criteria?: Record<string, unknown>): unknown | 'unknown' {
    // Default: unknown (requires domain-specific implementation)
    return 'unknown';
  }

  getProperty(object: unknown, property: string): unknown | 'unknown' {
    if (object === 'unknown') return 'unknown';
    if (object === null || object === undefined) return 'unknown';
    if (typeof object === 'object') {
      const value = (object as Record<string, unknown>)[property];
      return value !== undefined ? value : 'unknown';
    }
    return 'unknown';
  }

  regex(value: unknown, pattern: string): TriState {
    if (value === 'unknown') return 'unknown';
    if (typeof value !== 'string') return 'unknown';
    try {
      const re = new RegExp(pattern);
      return re.test(value) ? 'true' : 'false';
    } catch {
      // Invalid regex pattern
      return 'unknown';
    }
  }
}

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Context for expression evaluation
 */
export interface EvaluationContext {
  /** Runtime values (variables in scope) */
  variables: Map<string, unknown>;
  /** Input values for the behavior */
  input?: Record<string, unknown>;
  /** Result value (for postconditions) */
  result?: unknown;
  /** Old state snapshot (for old() expressions) */
  oldState?: Record<string, unknown>;
  /** Adapter for domain primitives */
  adapter: ExpressionAdapter;
  /** Enable strict mode (unknown -> false) */
  strict?: boolean;
  /** Maximum evaluation depth */
  maxDepth?: number;
}

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Evaluation error with rich diagnostics
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public readonly location: SourceLocation,
    public readonly diagnostics: Diagnostic[] = [],
    public readonly expression?: Expression
  ) {
    super(message);
    this.name = 'EvaluationError';
  }

  /**
   * Format error with source location
   */
  format(): string {
    const loc = `${this.location.file}:${this.location.line}:${this.location.column}`;
    return `${this.message} at ${loc}`;
  }
}
