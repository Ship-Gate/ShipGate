// ============================================================================
// ISL Expression Evaluator v1 - Postcondition Evaluator
// ============================================================================
//
// Evaluates postcondition predicates using trace/adapter data to compute
// before/after state comparisons.
//
// Supports:
// - increased_by(field, delta): Check if field value increased by delta
// - none_created(entityType): Check if no entities of type were created
// - incremented(field): Check if field was incremented by any amount
//
// ============================================================================

import type { EvalResult, EvalContext, EvalKind, EvalAdapter } from './types.js';
import { ok, fail, unknown, fromKind } from './types.js';
import type {
  IncreasedByPredicate,
  NoneCreatedPredicate,
  IncrementedPredicate,
  EntityCreatedPredicate,
  PostconditionPredicate,
  PostconditionResult,
  PostconditionDetails,
  FieldReference,
  DeltaValue,
  PostconditionContext,
  StateSnapshot,
  TraceEventData,
} from './postcondition-types.js';
import {
  isIncreasedByPredicate,
  isNoneCreatedPredicate,
  isIncrementedPredicate,
  isEntityCreatedPredicate,
} from './postcondition-types.js';

// ============================================================================
// POSTCONDITION ADAPTER INTERFACE
// ============================================================================

/**
 * Extended adapter interface for postcondition evaluation
 * Provides before/after state access and entity creation tracking
 */
export interface PostconditionAdapter extends EvalAdapter {
  /**
   * Get the value of a field before behavior execution
   */
  getBeforeValue(field: FieldReference): unknown | 'unknown';
  
  /**
   * Get the value of a field after behavior execution
   */
  getAfterValue(field: FieldReference): unknown | 'unknown';
  
  /**
   * Check if an entity of the given type was created during behavior execution
   */
  wasEntityCreated(entityType: string): boolean | 'unknown';
  
  /**
   * Get the count of entities created during behavior execution
   */
  getCreatedEntityCount(entityType: string): number | 'unknown';
  
  /**
   * Get all creation events for an entity type
   */
  getCreationEvents(entityType: string): TraceEventData[];
}

// ============================================================================
// MAIN POSTCONDITION EVALUATOR
// ============================================================================

/**
 * Evaluate a postcondition predicate
 * 
 * @param predicate - The postcondition predicate to evaluate
 * @param ctx - The evaluation context (should include postcondition adapter)
 * @returns Evaluation result with postcondition details
 */
export function evaluatePostcondition(
  predicate: PostconditionPredicate,
  ctx: PostconditionEvalContext
): PostconditionResult {
  if (isIncreasedByPredicate(predicate)) {
    return evaluateIncreasedBy(predicate, ctx);
  }
  
  if (isNoneCreatedPredicate(predicate)) {
    return evaluateNoneCreated(predicate, ctx);
  }
  
  if (isIncrementedPredicate(predicate)) {
    return evaluateIncremented(predicate, ctx);
  }
  
  if (isEntityCreatedPredicate(predicate)) {
    return evaluateEntityCreated(predicate, ctx);
  }
  
  return {
    ...unknown(`Unknown postcondition predicate kind: ${predicate.predicateKind}`),
    postconditionDetails: {
      predicateKind: predicate.predicateKind,
    },
  };
}

// ============================================================================
// POSTCONDITION EVALUATION CONTEXT
// ============================================================================

/**
 * Context for postcondition evaluation with required adapter
 */
export interface PostconditionEvalContext {
  /** Standard evaluation context properties */
  variables: Map<string, unknown>;
  input: Record<string, unknown>;
  result?: unknown;
  
  /** Postcondition adapter (required) */
  adapter: PostconditionAdapter;
  
  /** Optional: direct state snapshots */
  beforeState?: StateSnapshot;
  afterState?: StateSnapshot;
  
  /** Optional: trace events */
  traceEvents?: TraceEventData[];
}

/**
 * Create a postcondition evaluation context
 */
export function createPostconditionContext(options: {
  adapter: PostconditionAdapter;
  variables?: Map<string, unknown>;
  input?: Record<string, unknown>;
  result?: unknown;
  beforeState?: StateSnapshot;
  afterState?: StateSnapshot;
  traceEvents?: TraceEventData[];
}): PostconditionEvalContext {
  return {
    variables: options.variables ?? new Map(),
    input: options.input ?? {},
    result: options.result,
    adapter: options.adapter,
    beforeState: options.beforeState,
    afterState: options.afterState,
    traceEvents: options.traceEvents,
  };
}

// ============================================================================
// INCREASED_BY EVALUATOR
// ============================================================================

/**
 * Evaluate an IncreasedByPredicate
 * 
 * Checks if: after(field) - before(field) == delta
 * (or for decreased: before(field) - after(field) == delta)
 */
function evaluateIncreasedBy(
  predicate: IncreasedByPredicate,
  ctx: PostconditionEvalContext
): PostconditionResult {
  const { field, delta, direction } = predicate;
  
  // Get before and after values
  const beforeValue = ctx.adapter.getBeforeValue(field);
  const afterValue = ctx.adapter.getAfterValue(field);
  
  // Check for unknown values
  if (beforeValue === 'unknown') {
    return {
      ...unknown('Cannot determine before value for field'),
      postconditionDetails: {
        predicateKind: 'increased_by',
        beforeValue: 'unknown',
        afterValue,
      },
    };
  }
  
  if (afterValue === 'unknown') {
    return {
      ...unknown('Cannot determine after value for field'),
      postconditionDetails: {
        predicateKind: 'increased_by',
        beforeValue,
        afterValue: 'unknown',
      },
    };
  }
  
  // Ensure numeric values
  if (typeof beforeValue !== 'number' || typeof afterValue !== 'number') {
    return {
      ...fail(`Field values must be numeric: before=${beforeValue}, after=${afterValue}`),
      postconditionDetails: {
        predicateKind: 'increased_by',
        beforeValue,
        afterValue,
      },
    };
  }
  
  // Resolve delta value
  const expectedDelta = resolveDelta(delta, ctx);
  if (expectedDelta === 'unknown') {
    return {
      ...unknown('Cannot resolve delta value'),
      postconditionDetails: {
        predicateKind: 'increased_by',
        beforeValue,
        afterValue,
        expectedDelta: 'unknown' as unknown as number,
      },
    };
  }
  
  // Compute actual delta
  const computedDelta = direction === 'increased'
    ? afterValue - beforeValue
    : beforeValue - afterValue;
  
  // Compare
  const passed = computedDelta === expectedDelta;
  
  const details: PostconditionDetails = {
    predicateKind: 'increased_by',
    beforeValue,
    afterValue,
    computedDelta,
    expectedDelta,
  };
  
  if (passed) {
    return {
      ...ok({ before: beforeValue, after: afterValue, delta: computedDelta }),
      postconditionDetails: details,
    };
  }
  
  return {
    ...fail(
      `Field ${direction} by ${computedDelta}, expected ${expectedDelta}. ` +
      `(before: ${beforeValue}, after: ${afterValue})`
    ),
    postconditionDetails: details,
  };
}

/**
 * Resolve a delta value to a number
 */
function resolveDelta(delta: DeltaValue, ctx: PostconditionEvalContext): number | 'unknown' {
  switch (delta.kind) {
    case 'literal':
      return delta.value;
    
    case 'variable': {
      const value = resolveVariable(delta.name, ctx);
      if (value === 'unknown' || typeof value !== 'number') {
        return 'unknown';
      }
      return value;
    }
    
    case 'expression':
      // For complex expressions, would need to use main evaluator
      return 'unknown';
    
    default:
      return 'unknown';
  }
}

/**
 * Resolve a variable from context
 */
function resolveVariable(name: string, ctx: PostconditionEvalContext): unknown {
  // Check path (e.g., "input.amount" or "refund_amount")
  const parts = name.split('.');
  
  // If it starts with "input", look in input
  if (parts[0] === 'input' && parts.length > 1) {
    const key = parts.slice(1).join('.');
    return ctx.input[key] ?? ctx.input[parts[1]] ?? 'unknown';
  }
  
  // Check variables
  if (ctx.variables.has(name)) {
    return ctx.variables.get(name);
  }
  
  // Check input directly
  if (name in ctx.input) {
    return ctx.input[name];
  }
  
  return 'unknown';
}

// ============================================================================
// NONE_CREATED EVALUATOR
// ============================================================================

/**
 * Evaluate a NoneCreatedPredicate
 * 
 * Checks if no entities of the given type were created during behavior execution
 */
function evaluateNoneCreated(
  predicate: NoneCreatedPredicate,
  ctx: PostconditionEvalContext
): PostconditionResult {
  const { entityType, alias } = predicate;
  
  // Check if entity was created
  const wasCreated = ctx.adapter.wasEntityCreated(entityType);
  
  if (wasCreated === 'unknown') {
    return {
      ...unknown(`Cannot determine if ${entityType} was created`),
      postconditionDetails: {
        predicateKind: 'none_created',
      },
    };
  }
  
  const createdEntities = ctx.adapter.getCreationEvents(entityType);
  
  const details: PostconditionDetails = {
    predicateKind: 'none_created',
    createdEntities: createdEntities.map(e => e.entityId ?? 'unknown'),
  };
  
  if (!wasCreated) {
    return {
      ...ok({ entityType, created: false }),
      postconditionDetails: details,
    };
  }
  
  const entityName = alias || entityType;
  return {
    ...fail(
      `Expected no ${entityName} to be created, but ${createdEntities.length} was created`
    ),
    postconditionDetails: details,
  };
}

// ============================================================================
// INCREMENTED EVALUATOR
// ============================================================================

/**
 * Evaluate an IncrementedPredicate
 * 
 * Checks if field was incremented by any positive amount
 */
function evaluateIncremented(
  predicate: IncrementedPredicate,
  ctx: PostconditionEvalContext
): PostconditionResult {
  const { field } = predicate;
  
  // Get before and after values
  const beforeValue = ctx.adapter.getBeforeValue(field);
  const afterValue = ctx.adapter.getAfterValue(field);
  
  // Check for unknown values
  if (beforeValue === 'unknown') {
    return {
      ...unknown('Cannot determine before value for field'),
      postconditionDetails: {
        predicateKind: 'incremented',
        beforeValue: 'unknown',
        afterValue,
      },
    };
  }
  
  if (afterValue === 'unknown') {
    return {
      ...unknown('Cannot determine after value for field'),
      postconditionDetails: {
        predicateKind: 'incremented',
        beforeValue,
        afterValue: 'unknown',
      },
    };
  }
  
  // Ensure numeric values
  if (typeof beforeValue !== 'number' || typeof afterValue !== 'number') {
    return {
      ...fail(`Field values must be numeric: before=${beforeValue}, after=${afterValue}`),
      postconditionDetails: {
        predicateKind: 'incremented',
        beforeValue,
        afterValue,
      },
    };
  }
  
  const computedDelta = afterValue - beforeValue;
  const passed = computedDelta > 0;
  
  const details: PostconditionDetails = {
    predicateKind: 'incremented',
    beforeValue,
    afterValue,
    computedDelta,
  };
  
  if (passed) {
    return {
      ...ok({ before: beforeValue, after: afterValue, delta: computedDelta }),
      postconditionDetails: details,
    };
  }
  
  if (computedDelta === 0) {
    return {
      ...fail(`Field was not incremented (stayed at ${beforeValue})`),
      postconditionDetails: details,
    };
  }
  
  return {
    ...fail(`Field was decremented by ${-computedDelta}, expected increment`),
    postconditionDetails: details,
  };
}

// ============================================================================
// ENTITY_CREATED EVALUATOR
// ============================================================================

/**
 * Evaluate an EntityCreatedPredicate
 * 
 * Checks if entity was created (positive version of none_created)
 */
function evaluateEntityCreated(
  predicate: EntityCreatedPredicate,
  ctx: PostconditionEvalContext
): PostconditionResult {
  const { entityType, count } = predicate;
  
  // Check if entity was created
  const wasCreated = ctx.adapter.wasEntityCreated(entityType);
  
  if (wasCreated === 'unknown') {
    return {
      ...unknown(`Cannot determine if ${entityType} was created`),
      postconditionDetails: {
        predicateKind: 'entity_created',
      },
    };
  }
  
  const createdCount = ctx.adapter.getCreatedEntityCount(entityType);
  const createdEntities = ctx.adapter.getCreationEvents(entityType);
  
  const details: PostconditionDetails = {
    predicateKind: 'entity_created',
    createdEntities: createdEntities.map(e => e.entityId ?? 'unknown'),
  };
  
  // If specific count is expected
  if (count !== undefined) {
    if (createdCount === 'unknown') {
      return {
        ...unknown(`Cannot determine creation count for ${entityType}`),
        postconditionDetails: details,
      };
    }
    
    if (createdCount === count) {
      return {
        ...ok({ entityType, count: createdCount }),
        postconditionDetails: details,
      };
    }
    
    return {
      ...fail(`Expected ${count} ${entityType} created, but got ${createdCount}`),
      postconditionDetails: details,
    };
  }
  
  // Just check if at least one was created
  if (wasCreated) {
    return {
      ...ok({ entityType, created: true }),
      postconditionDetails: details,
    };
  }
  
  return {
    ...fail(`Expected ${entityType} to be created, but none was`),
    postconditionDetails: details,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Evaluate multiple postconditions and return combined result
 */
export function evaluatePostconditions(
  predicates: PostconditionPredicate[],
  ctx: PostconditionEvalContext
): { overall: EvalKind; results: PostconditionResult[] } {
  const results = predicates.map(p => evaluatePostcondition(p, ctx));
  
  // Combine results: any false -> false, any unknown -> unknown, else true
  let overall: EvalKind = 'true';
  
  for (const result of results) {
    if (result.kind === 'false') {
      overall = 'false';
      break;
    }
    if (result.kind === 'unknown') {
      overall = 'unknown';
    }
  }
  
  return { overall, results };
}

/**
 * Create a summary of postcondition evaluation
 */
export function summarizePostconditionResults(
  results: PostconditionResult[]
): string {
  const passed = results.filter(r => r.kind === 'true').length;
  const failed = results.filter(r => r.kind === 'false').length;
  const unknown = results.filter(r => r.kind === 'unknown').length;
  
  const lines: string[] = [
    `Postcondition Evaluation: ${passed} passed, ${failed} failed, ${unknown} unknown`,
    '',
  ];
  
  for (const result of results) {
    const status = result.kind === 'true' ? '✓' : result.kind === 'false' ? '✗' : '?';
    const kind = result.postconditionDetails?.predicateKind ?? 'unknown';
    const reason = result.reason ?? '';
    
    lines.push(`  ${status} ${kind}: ${reason || 'OK'}`);
    
    // Add details for failed/unknown
    if (result.kind !== 'true' && result.postconditionDetails) {
      const details = result.postconditionDetails;
      if (details.beforeValue !== undefined) {
        lines.push(`      before: ${JSON.stringify(details.beforeValue)}`);
      }
      if (details.afterValue !== undefined) {
        lines.push(`      after: ${JSON.stringify(details.afterValue)}`);
      }
      if (details.computedDelta !== undefined) {
        lines.push(`      computed delta: ${details.computedDelta}`);
      }
      if (details.expectedDelta !== undefined) {
        lines.push(`      expected delta: ${details.expectedDelta}`);
      }
    }
  }
  
  return lines.join('\n');
}
