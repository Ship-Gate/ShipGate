// ============================================================================
// ISL Expression Evaluator v1 - Type Definitions
// ============================================================================

/**
 * Tri-state result kind for expression evaluation
 * - "true": Expression definitely evaluates to true
 * - "false": Expression definitely evaluates to false
 * - "unknown": Expression cannot be determined (missing data, runtime dependency)
 */
export type EvalKind = 'true' | 'false' | 'unknown';

/**
 * v1 Evaluation Result
 * Clean, minimal result type for expression evaluation
 */
export interface EvalResult {
  /** The tri-state evaluation result */
  kind: EvalKind;
  /** Human-readable reason for the result (especially for false/unknown) */
  reason?: string;
  /** Additional evidence or context for the result */
  evidence?: unknown;
}

// ============================================================================
// TRI-STATE LOGIC OPERATIONS
// ============================================================================

/**
 * Tri-state AND truth table:
 * | A       | B       | Result  |
 * |---------|---------|---------|
 * | true    | true    | true    |
 * | true    | false   | false   |
 * | true    | unknown | unknown |
 * | false   | true    | false   |
 * | false   | false   | false   |
 * | false   | unknown | false   | ← false dominates
 * | unknown | true    | unknown |
 * | unknown | false   | false   | ← false dominates
 * | unknown | unknown | unknown |
 */
export function triAnd(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'false' || b === 'false') return 'false';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'true';
}

/**
 * Tri-state OR truth table:
 * | A       | B       | Result  |
 * |---------|---------|---------|
 * | true    | true    | true    |
 * | true    | false   | true    |
 * | true    | unknown | true    | ← true dominates
 * | false   | true    | true    |
 * | false   | false   | false   |
 * | false   | unknown | unknown |
 * | unknown | true    | true    | ← true dominates
 * | unknown | false   | unknown |
 * | unknown | unknown | unknown |
 */
export function triOr(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'true' || b === 'true') return 'true';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'false';
}

/**
 * Tri-state NOT truth table:
 * | A       | Result  |
 * |---------|---------|
 * | true    | false   |
 * | false   | true    |
 * | unknown | unknown |
 */
export function triNot(a: EvalKind): EvalKind {
  if (a === 'true') return 'false';
  if (a === 'false') return 'true';
  return 'unknown';
}

/**
 * Tri-state IMPLIES implemented as (!A || B)
 * Truth table:
 * | A       | B       | !A      | !A || B |
 * |---------|---------|---------|---------|
 * | true    | true    | false   | true    |
 * | true    | false   | false   | false   |
 * | true    | unknown | false   | unknown |
 * | false   | true    | true    | true    | ← false implies anything is true
 * | false   | false   | true    | true    | ← false implies anything is true
 * | false   | unknown | true    | true    | ← false implies anything is true
 * | unknown | true    | unknown | true    | ← true dominates in OR
 * | unknown | false   | unknown | unknown |
 * | unknown | unknown | unknown | unknown |
 */
export function triImplies(a: EvalKind, b: EvalKind): EvalKind {
  return triOr(triNot(a), b);
}

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Context for expression evaluation
 */
export interface EvalContext {
  /** Variables in scope (from quantifiers, let bindings, etc.) */
  variables: Map<string, unknown>;
  /** Input parameters to the behavior */
  input: Record<string, unknown>;
  /** Result value (for postconditions) */
  result?: unknown;
  /** Old state snapshot (for old() expressions) */
  oldState?: Map<string, unknown>;
  /** Adapter for domain primitives */
  adapter: EvalAdapter;
  /** Maximum recursion depth */
  maxDepth?: number;
}

/**
 * Adapter interface for domain-specific operations
 */
export interface EvalAdapter {
  /**
   * Check if a value is valid (domain-specific validation)
   */
  isValid(value: unknown): EvalKind;
  
  /**
   * Get length of a value (string, array)
   * Returns 'unknown' if value type doesn't have length
   */
  length(value: unknown): number | 'unknown';
  
  /**
   * Check if an entity exists
   */
  exists(entityName: string, criteria?: Record<string, unknown>): EvalKind;
  
  /**
   * Lookup an entity by criteria
   */
  lookup(entityName: string, criteria?: Record<string, unknown>): unknown | 'unknown';
  
  /**
   * Get a property from an object
   * Returns 'unknown' if property doesn't exist (safe access)
   */
  getProperty(object: unknown, property: string): unknown | 'unknown';
  
  /**
   * Get current timestamp (for now() function)
   * Returns ISO date string or epoch milliseconds
   */
  now(): number | string;
  
  /**
   * Check if a string matches a format pattern
   * Common formats: 'email', 'uuid', 'url', 'phone', 'date', 'iso8601'
   * Can also accept regex pattern
   */
  isValidFormat(value: unknown, format: string): EvalKind;
  
  /**
   * Test if a string matches a regular expression pattern
   */
  regex(value: unknown, pattern: string): EvalKind;
  
  /**
   * Check if a collection contains a value
   */
  contains(collection: unknown, value: unknown): EvalKind;
}

/**
 * Format validation patterns
 */
const FORMAT_PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  url: /^https?:\/\/[^\s]+$/,
  phone: /^\+?[\d\s\-()]{10,}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  iso8601: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  hex: /^[0-9a-fA-F]+$/,
  base64: /^[A-Za-z0-9+/]+=*$/,
  jwt: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
};

/**
 * Default adapter with safe implementations
 */
export class DefaultEvalAdapter implements EvalAdapter {
  isValid(value: unknown): EvalKind {
    if (value === null || value === undefined) return 'false';
    if (value === 'unknown') return 'unknown';
    if (typeof value === 'string') return value.length > 0 ? 'true' : 'false';
    if (typeof value === 'number') return !isNaN(value) && isFinite(value) ? 'true' : 'false';
    if (typeof value === 'boolean') return 'true';
    if (Array.isArray(value)) return value.length > 0 ? 'true' : 'false';
    return 'true';
  }

  length(value: unknown): number | 'unknown' {
    if (value === 'unknown') return 'unknown';
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    return 'unknown';
  }

  exists(_entityName: string, _criteria?: Record<string, unknown>): EvalKind {
    // Default: cannot determine without domain knowledge
    return 'unknown';
  }

  lookup(_entityName: string, _criteria?: Record<string, unknown>): unknown | 'unknown' {
    // Default: cannot determine without domain knowledge
    return 'unknown';
  }

  getProperty(object: unknown, property: string): unknown | 'unknown' {
    if (object === null || object === undefined) return 'unknown';
    if (object === 'unknown') return 'unknown';
    if (typeof object !== 'object') return 'unknown';
    
    const obj = object as Record<string, unknown>;
    if (!(property in obj)) return 'unknown';
    
    return obj[property];
  }
  
  now(): number {
    return Date.now();
  }
  
  isValidFormat(value: unknown, format: string): EvalKind {
    if (value === null || value === undefined) return 'false';
    if (value === 'unknown') return 'unknown';
    if (typeof value !== 'string') return 'false';
    
    // Check built-in format patterns
    const pattern = FORMAT_PATTERNS[format.toLowerCase()];
    if (pattern) {
      return pattern.test(value) ? 'true' : 'false';
    }
    
    // Treat format as custom regex pattern
    try {
      const regex = new RegExp(format);
      return regex.test(value) ? 'true' : 'false';
    } catch {
      // Invalid regex pattern
      return 'unknown';
    }
  }
  
  regex(value: unknown, pattern: string): EvalKind {
    if (value === null || value === undefined) return 'false';
    if (value === 'unknown') return 'unknown';
    if (typeof value !== 'string') return 'false';
    
    try {
      const regex = new RegExp(pattern);
      return regex.test(value) ? 'true' : 'false';
    } catch {
      return 'unknown';
    }
  }
  
  contains(collection: unknown, value: unknown): EvalKind {
    if (collection === 'unknown' || value === 'unknown') return 'unknown';
    if (!Array.isArray(collection)) return 'false';
    
    // Use deep equality for object comparison
    for (const item of collection) {
      if (deepEqualInternal(item, value)) {
        return 'true';
      }
    }
    return 'false';
  }
}

/**
 * Internal deep equality helper for adapter
 */
function deepEqualInternal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqualInternal(val, b[i]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key =>
      deepEqualInternal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  
  return false;
}

// ============================================================================
// RESULT CONSTRUCTORS
// ============================================================================

/**
 * Create a "true" result
 */
export function ok(evidence?: unknown): EvalResult {
  return { kind: 'true', evidence };
}

/**
 * Create a "false" result with reason
 */
export function fail(reason: string, evidence?: unknown): EvalResult {
  return { kind: 'false', reason, evidence };
}

/**
 * Create an "unknown" result with reason
 */
export function unknown(reason: string, evidence?: unknown): EvalResult {
  return { kind: 'unknown', reason, evidence };
}

/**
 * Convert a boolean to EvalResult
 */
export function fromBool(value: boolean, evidence?: unknown): EvalResult {
  return value ? ok(evidence) : fail('Value is false', evidence);
}

/**
 * Convert EvalKind to EvalResult
 */
export function fromKind(kind: EvalKind, reason?: string, evidence?: unknown): EvalResult {
  if (kind === 'true') return ok(evidence);
  if (kind === 'false') return fail(reason ?? 'Evaluated to false', evidence);
  return unknown(reason ?? 'Cannot determine', evidence);
}
