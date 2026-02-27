// ============================================================================
// ISL Expression Evaluator v1 - Postcondition Types
// ============================================================================
//
// Types and interfaces for evaluating postcondition-specific constructs:
// - "field increased by delta" (IncreasedByPredicate)
// - "no Entity created" (NoneCreatedPredicate)
//
// These constructs require before/after state comparison during evaluation.
//
// ============================================================================

import type { EvalKind, EvalResult, EvalContext } from './types.js';

// ============================================================================
// POSTCONDITION PREDICATE TYPES
// ============================================================================

/**
 * Base interface for all postcondition predicates
 */
export interface PostconditionPredicate {
  /** The kind of postcondition predicate */
  readonly predicateKind: string;
}

/**
 * Represents a field delta assertion:
 * "field increased by delta" or "field decreased by delta"
 * 
 * ISL examples:
 * - User.failed_attempts increased by 1
 * - Payment.refunded_amount increased by refund_amount
 * - User.lookup_by_email(input.email).failed_attempts increased by 1
 * 
 * Evaluation semantics:
 * - after(field) - before(field) == delta  (for increased)
 * - before(field) - after(field) == delta  (for decreased)
 */
export interface IncreasedByPredicate extends PostconditionPredicate {
  readonly predicateKind: 'increased_by';
  /** The field path or expression to compare */
  readonly field: FieldReference;
  /** The expected delta (can be a literal or expression reference) */
  readonly delta: DeltaValue;
  /** Direction of change */
  readonly direction: 'increased' | 'decreased';
}

/**
 * Represents an entity non-creation assertion:
 * "no Entity created"
 * 
 * ISL examples:
 * - no Session created
 * - no token generated
 * 
 * Evaluation semantics:
 * - Check trace events for entity creation
 * - Entity.created == false
 * - count(created_entities_of_type) == 0
 */
export interface NoneCreatedPredicate extends PostconditionPredicate {
  readonly predicateKind: 'none_created';
  /** The entity type that should not have been created */
  readonly entityType: string;
  /** Optional: specific entity alias (e.g., "token" vs "Session") */
  readonly alias?: string;
}

/**
 * Represents an entity creation assertion:
 * "Entity created" or "Entity.created == true"
 * 
 * This is the positive counterpart to NoneCreatedPredicate
 */
export interface EntityCreatedPredicate extends PostconditionPredicate {
  readonly predicateKind: 'entity_created';
  /** The entity type that should have been created */
  readonly entityType: string;
  /** Optional: expected count of created entities */
  readonly count?: number;
}

/**
 * Represents a field increment assertion (simpler form):
 * "field incremented" (without specific delta)
 * 
 * ISL example:
 * - actor.user.failed_attempts incremented
 */
export interface IncrementedPredicate extends PostconditionPredicate {
  readonly predicateKind: 'incremented';
  /** The field that should have been incremented */
  readonly field: FieldReference;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

/**
 * Reference to a field that can be evaluated
 * Can be a simple path or include method calls
 */
export type FieldReference =
  | SimpleFieldPath
  | MethodCallField
  | ExpressionField;

/**
 * Simple property path: User.failed_attempts
 */
export interface SimpleFieldPath {
  readonly kind: 'simple_path';
  /** Path segments: ['User', 'failed_attempts'] */
  readonly path: string[];
}

/**
 * Method call field: User.lookup_by_email(input.email).failed_attempts
 */
export interface MethodCallField {
  readonly kind: 'method_call';
  /** Entity type: 'User' */
  readonly entity: string;
  /** Method name: 'lookup_by_email' */
  readonly method: string;
  /** Method arguments as expressions */
  readonly args: unknown[];
  /** Property path after method call: ['failed_attempts'] */
  readonly propertyPath: string[];
}

/**
 * Generic expression field (for complex cases)
 */
export interface ExpressionField {
  readonly kind: 'expression';
  /** The raw expression to evaluate */
  readonly expression: unknown;
}

/**
 * Delta value for increased_by/decreased_by predicates
 */
export type DeltaValue =
  | { kind: 'literal'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'expression'; expression: unknown };

// ============================================================================
// EVALUATION CONTEXT EXTENSIONS
// ============================================================================

/**
 * Extended context for postcondition evaluation
 * Includes before/after state snapshots
 */
export interface PostconditionContext extends EvalContext {
  /** State snapshot before behavior execution */
  beforeState: StateSnapshot;
  /** State snapshot after behavior execution */
  afterState: StateSnapshot;
  /** Trace events from behavior execution */
  traceEvents?: TraceEventData[];
}

/**
 * State snapshot for before/after comparison
 */
export interface StateSnapshot {
  /** Timestamp of snapshot */
  timestamp: string;
  /** Entity states by type and id */
  entities: Map<string, EntityState>;
  /** Property values by path */
  properties: Map<string, unknown>;
}

/**
 * State of a single entity
 */
export interface EntityState {
  /** Entity type */
  entityType: string;
  /** Entity id */
  id: string;
  /** Entity data */
  data: Record<string, unknown>;
}

/**
 * Trace event data for postcondition evaluation
 */
export interface TraceEventData {
  /** Event type */
  kind: string;
  /** Event timestamp */
  timestamp: string;
  /** Entity type (for entity events) */
  entityType?: string;
  /** Entity id (for entity events) */
  entityId?: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

// ============================================================================
// POSTCONDITION EVALUATION RESULT
// ============================================================================

/**
 * Extended result for postcondition evaluation
 * Includes comparison details
 */
export interface PostconditionResult extends EvalResult {
  /** Details about the postcondition evaluation */
  postconditionDetails?: PostconditionDetails;
}

/**
 * Details about postcondition evaluation
 */
export interface PostconditionDetails {
  /** The type of postcondition evaluated */
  predicateKind: string;
  /** Before value (for comparisons) */
  beforeValue?: unknown;
  /** After value (for comparisons) */
  afterValue?: unknown;
  /** Computed delta (for increased_by) */
  computedDelta?: number;
  /** Expected delta (for increased_by) */
  expectedDelta?: number;
  /** Created entities (for none_created) */
  createdEntities?: string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is an IncreasedByPredicate
 */
export function isIncreasedByPredicate(value: unknown): value is IncreasedByPredicate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PostconditionPredicate).predicateKind === 'increased_by'
  );
}

/**
 * Check if a value is a NoneCreatedPredicate
 */
export function isNoneCreatedPredicate(value: unknown): value is NoneCreatedPredicate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PostconditionPredicate).predicateKind === 'none_created'
  );
}

/**
 * Check if a value is an EntityCreatedPredicate
 */
export function isEntityCreatedPredicate(value: unknown): value is EntityCreatedPredicate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PostconditionPredicate).predicateKind === 'entity_created'
  );
}

/**
 * Check if a value is an IncrementedPredicate
 */
export function isIncrementedPredicate(value: unknown): value is IncrementedPredicate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PostconditionPredicate).predicateKind === 'incremented'
  );
}

/**
 * Check if a value is any postcondition predicate
 */
export function isPostconditionPredicate(value: unknown): value is PostconditionPredicate {
  return (
    isIncreasedByPredicate(value) ||
    isNoneCreatedPredicate(value) ||
    isEntityCreatedPredicate(value) ||
    isIncrementedPredicate(value)
  );
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an IncreasedByPredicate
 */
export function increasedBy(
  field: FieldReference,
  delta: DeltaValue,
  direction: 'increased' | 'decreased' = 'increased'
): IncreasedByPredicate {
  return {
    predicateKind: 'increased_by',
    field,
    delta,
    direction,
  };
}

/**
 * Create a NoneCreatedPredicate
 */
export function noneCreated(entityType: string, alias?: string): NoneCreatedPredicate {
  return {
    predicateKind: 'none_created',
    entityType,
    alias,
  };
}

/**
 * Create an EntityCreatedPredicate
 */
export function entityCreated(entityType: string, count?: number): EntityCreatedPredicate {
  return {
    predicateKind: 'entity_created',
    entityType,
    count,
  };
}

/**
 * Create an IncrementedPredicate
 */
export function incremented(field: FieldReference): IncrementedPredicate {
  return {
    predicateKind: 'incremented',
    field,
  };
}

/**
 * Create a simple field path reference
 */
export function simplePath(...segments: string[]): SimpleFieldPath {
  return { kind: 'simple_path', path: segments };
}

/**
 * Create a method call field reference
 */
export function methodCallField(
  entity: string,
  method: string,
  args: unknown[],
  ...propertyPath: string[]
): MethodCallField {
  return {
    kind: 'method_call',
    entity,
    method,
    args,
    propertyPath,
  };
}

/**
 * Create a literal delta value
 */
export function literalDelta(value: number): DeltaValue {
  return { kind: 'literal', value };
}

/**
 * Create a variable delta value
 */
export function variableDelta(name: string): DeltaValue {
  return { kind: 'variable', name };
}
