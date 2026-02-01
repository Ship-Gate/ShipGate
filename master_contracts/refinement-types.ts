// ============================================================================
// ISL Refinement Types - Types with Predicates
// Version: 0.1.0
// ============================================================================

/**
 * Refinement Types allow types to be constrained by predicates.
 * This enables encoding business rules and invariants at the type level.
 * 
 * Examples:
 * - NonEmptyString: String where length > 0
 * - PositiveInt: Int where value > 0
 * - ValidEmail: String where matches email pattern
 * - Age: Int where value >= 0 and value <= 150
 */

// ============================================================================
// CORE REFINEMENT TYPE
// ============================================================================

/**
 * A refinement type {T | P} represents values of type T satisfying predicate P
 */
export interface Refinement<T, P extends Predicate<T>> {
  readonly baseType: T;
  readonly predicate: P;
  readonly value: T;
}

/**
 * Predicate over a type
 */
export interface Predicate<T> {
  readonly description: string;
  readonly check: (value: T) => boolean;
}

/**
 * Create a refinement type
 */
export function refine<T, P extends Predicate<T>>(
  value: T,
  predicate: P
): Refinement<T, P> | null {
  if (predicate.check(value)) {
    return { baseType: value, predicate, value };
  }
  return null;
}

/**
 * Unsafe coercion (for trusted inputs)
 */
export function unsafeRefine<T, P extends Predicate<T>>(
  value: T,
  predicate: P
): Refinement<T, P> {
  return { baseType: value, predicate, value };
}

// ============================================================================
// COMMON PREDICATES
// ============================================================================

// Numeric predicates
export const positive: Predicate<number> = {
  description: 'value > 0',
  check: (n) => n > 0,
};

export const nonNegative: Predicate<number> = {
  description: 'value >= 0',
  check: (n) => n >= 0,
};

export const negative: Predicate<number> = {
  description: 'value < 0',
  check: (n) => n < 0,
};

export function inRange(min: number, max: number): Predicate<number> {
  return {
    description: `value >= ${min} and value <= ${max}`,
    check: (n) => n >= min && n <= max,
  };
}

export function greaterThan(threshold: number): Predicate<number> {
  return {
    description: `value > ${threshold}`,
    check: (n) => n > threshold,
  };
}

export function lessThan(threshold: number): Predicate<number> {
  return {
    description: `value < ${threshold}`,
    check: (n) => n < threshold,
  };
}

export function divisibleBy(divisor: number): Predicate<number> {
  return {
    description: `value % ${divisor} == 0`,
    check: (n) => n % divisor === 0,
  };
}

// String predicates
export const nonEmpty: Predicate<string> = {
  description: 'length > 0',
  check: (s) => s.length > 0,
};

export function minLength(min: number): Predicate<string> {
  return {
    description: `length >= ${min}`,
    check: (s) => s.length >= min,
  };
}

export function maxLength(max: number): Predicate<string> {
  return {
    description: `length <= ${max}`,
    check: (s) => s.length <= max,
  };
}

export function lengthBetween(min: number, max: number): Predicate<string> {
  return {
    description: `length >= ${min} and length <= ${max}`,
    check: (s) => s.length >= min && s.length <= max,
  };
}

export function matches(pattern: RegExp): Predicate<string> {
  return {
    description: `matches ${pattern}`,
    check: (s) => pattern.test(s),
  };
}

export function startsWith(prefix: string): Predicate<string> {
  return {
    description: `starts with "${prefix}"`,
    check: (s) => s.startsWith(prefix),
  };
}

export function endsWith(suffix: string): Predicate<string> {
  return {
    description: `ends with "${suffix}"`,
    check: (s) => s.endsWith(suffix),
  };
}

// Array predicates
export function nonEmptyArray<T>(): Predicate<T[]> {
  return {
    description: 'length > 0',
    check: (arr) => arr.length > 0,
  };
}

export function arrayMinLength<T>(min: number): Predicate<T[]> {
  return {
    description: `length >= ${min}`,
    check: (arr) => arr.length >= min,
  };
}

export function arrayMaxLength<T>(max: number): Predicate<T[]> {
  return {
    description: `length <= ${max}`,
    check: (arr) => arr.length <= max,
  };
}

export function allSatisfy<T>(predicate: Predicate<T>): Predicate<T[]> {
  return {
    description: `all elements satisfy: ${predicate.description}`,
    check: (arr) => arr.every(predicate.check),
  };
}

export function someSatisfy<T>(predicate: Predicate<T>): Predicate<T[]> {
  return {
    description: `some elements satisfy: ${predicate.description}`,
    check: (arr) => arr.some(predicate.check),
  };
}

// ============================================================================
// PREDICATE COMBINATORS
// ============================================================================

/**
 * Conjunction of predicates (AND)
 */
export function and<T>(p1: Predicate<T>, p2: Predicate<T>): Predicate<T> {
  return {
    description: `(${p1.description}) and (${p2.description})`,
    check: (v) => p1.check(v) && p2.check(v),
  };
}

/**
 * Disjunction of predicates (OR)
 */
export function or<T>(p1: Predicate<T>, p2: Predicate<T>): Predicate<T> {
  return {
    description: `(${p1.description}) or (${p2.description})`,
    check: (v) => p1.check(v) || p2.check(v),
  };
}

/**
 * Negation of predicate (NOT)
 */
export function not<T>(p: Predicate<T>): Predicate<T> {
  return {
    description: `not (${p.description})`,
    check: (v) => !p.check(v),
  };
}

/**
 * Implication (IF p1 THEN p2)
 */
export function implies<T>(p1: Predicate<T>, p2: Predicate<T>): Predicate<T> {
  return {
    description: `(${p1.description}) implies (${p2.description})`,
    check: (v) => !p1.check(v) || p2.check(v),
  };
}

// ============================================================================
// ISL REFINEMENT TYPE SYNTAX
// ============================================================================

/**
 * ISL syntax for refinement types:
 * 
 * ```isl
 * // Simple refinements
 * type PositiveInt = Int { value > 0 }
 * type NonEmptyString = String { length > 0 }
 * type Percentage = Decimal { value >= 0 and value <= 100 }
 * 
 * // Named refinements
 * type Age = Int {
 *   value >= 0
 *   value <= 150
 * }
 * 
 * // Pattern-based refinements
 * type Email = String {
 *   pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
 * }
 * 
 * type UUID = String {
 *   pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 *   length: 36
 * }
 * 
 * // Dependent refinements (value depends on other fields)
 * type DateRange = {
 *   start: Timestamp
 *   end: Timestamp { value > start }
 * }
 * 
 * // Refined collections
 * type NonEmptyList<T> = List<T> { length > 0 }
 * type BoundedList<T, N: Int> = List<T> { length <= N }
 * 
 * // Complex refinements
 * type ValidPassword = String {
 *   length >= 8
 *   length <= 128
 *   has_uppercase
 *   has_lowercase
 *   has_digit
 *   not_in_common_passwords
 * }
 * ```
 */

// ============================================================================
// COMMON REFINED TYPES
// ============================================================================

// Numeric refined types
export type PositiveInt = Refinement<number, typeof positive>;
export type NonNegativeInt = Refinement<number, typeof nonNegative>;
export type NegativeInt = Refinement<number, typeof negative>;
export type Percentage = Refinement<number, ReturnType<typeof inRange>>;

// String refined types
export type NonEmptyString = Refinement<string, typeof nonEmpty>;

// Email pattern
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const isEmail = matches(emailPattern);
export type Email = Refinement<string, typeof isEmail>;

// UUID pattern
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = matches(uuidPattern);
export type UUID = Refinement<string, typeof isUUID>;

// URL pattern
const urlPattern = /^https?:\/\/.+/;
export const isURL = matches(urlPattern);
export type URL = Refinement<string, typeof isURL>;

// ISO date pattern
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = matches(isoDatePattern);
export type ISODate = Refinement<string, typeof isISODate>;

// ============================================================================
// REFINEMENT TYPE AST
// ============================================================================

export interface RefinementTypeAST {
  kind: 'RefinementType';
  baseType: TypeAST;
  predicates: PredicateAST[];
}

export type TypeAST = 
  | { kind: 'Primitive'; name: string }
  | { kind: 'Reference'; name: string }
  | { kind: 'List'; element: TypeAST }
  | { kind: 'Map'; key: TypeAST; value: TypeAST }
  | { kind: 'Optional'; inner: TypeAST }
  | RefinementTypeAST;

export type PredicateAST =
  | ComparisonPredicate
  | PatternPredicate
  | PropertyPredicate
  | LogicalPredicate;

export interface ComparisonPredicate {
  kind: 'Comparison';
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=';
  left: ExpressionAST;
  right: ExpressionAST;
}

export interface PatternPredicate {
  kind: 'Pattern';
  pattern: string;
  flags?: string;
}

export interface PropertyPredicate {
  kind: 'Property';
  property: string;  // e.g., 'has_uppercase', 'is_finite'
}

export interface LogicalPredicate {
  kind: 'Logical';
  operator: 'and' | 'or' | 'not' | 'implies';
  operands: PredicateAST[];
}

export interface ExpressionAST {
  kind: 'Expression';
  // Simplified for illustration
  value: string;
}

// ============================================================================
// REFINEMENT TYPE CHECKING
// ============================================================================

/**
 * Check if a value satisfies a refinement type
 */
export function checkRefinement(
  value: unknown,
  refinementType: RefinementTypeAST
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check each predicate
  for (const predicate of refinementType.predicates) {
    const result = evaluatePredicate(value, predicate);
    if (!result.satisfied) {
      errors.push(result.error ?? 'Predicate not satisfied');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

function evaluatePredicate(
  value: unknown,
  predicate: PredicateAST
): { satisfied: boolean; error?: string } {
  // Implementation would evaluate predicate against value
  return { satisfied: true };
}

// ============================================================================
// SMT SOLVER INTEGRATION
// ============================================================================

/**
 * For complex refinement checking, ISL can integrate with SMT solvers
 * to prove that refinements are satisfiable and to verify type soundness.
 * 
 * Example: Proving that a function preserves refinements
 * 
 * ```isl
 * function divide(
 *   numerator: Int,
 *   denominator: Int { value != 0 }
 * ): Decimal {
 *   // SMT solver proves this is safe because denominator != 0
 *   return numerator / denominator
 * }
 * ```
 */

export interface SMTQuery {
  variables: Array<{
    name: string;
    type: string;
    constraints: string[];
  }>;
  assertions: string[];
  goal: 'satisfiable' | 'unsatisfiable' | 'prove';
}

export interface SMTResult {
  status: 'sat' | 'unsat' | 'unknown';
  model?: Record<string, unknown>;
  proof?: string;
}

/**
 * Generate SMT query from refinement types
 */
export function generateSMTQuery(
  refinements: RefinementTypeAST[]
): SMTQuery {
  // Implementation would translate refinements to SMT-LIB format
  return {
    variables: [],
    assertions: [],
    goal: 'satisfiable',
  };
}

// ============================================================================
// LIQUID TYPES
// ============================================================================

/**
 * Liquid Types are refinement types where predicates are automatically inferred.
 * ISL supports liquid type inference for common patterns.
 * 
 * Example:
 * ```isl
 * function abs(x: Int): Int { value >= 0 } {
 *   if (x >= 0) {
 *     return x  // Inferred: x >= 0, so return type is satisfied
 *   } else {
 *     return -x  // Inferred: x < 0, so -x > 0, return type satisfied
 *   }
 * }
 * ```
 */

export interface LiquidTypeInference {
  inferRefinements(functionAST: unknown): RefinementTypeAST[];
  verifyRefinements(functionAST: unknown, declared: RefinementTypeAST[]): boolean;
}
