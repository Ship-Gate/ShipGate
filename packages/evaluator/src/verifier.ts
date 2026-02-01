// ============================================================================
// ISL Expression Evaluator - Verification Bridge
// ============================================================================

import type {
  Value,
  EvaluationContext,
  SourceLocation,
  EntityStore,
  EntityStoreSnapshot,
  CheckType,
  CheckResult,
  VerificationFailure,
  VerificationResult,
} from './types.js';
import { EvaluationError } from './types.js';
import { Evaluator, expressionToString } from './evaluator.js';

// ============================================================================
// SPEC TYPES (simplified from parser AST)
// ============================================================================

interface BehaviorSpec {
  name: string;
  preconditions: ExpressionSpec[];
  postconditions: PostconditionSpec[];
  invariants: ExpressionSpec[];
}

interface PostconditionSpec {
  condition: 'success' | 'any_error' | string;
  predicates: ExpressionSpec[];
}

interface ExpressionSpec {
  expression: unknown; // AST Expression
  name?: string;
  location: SourceLocation;
}

// ============================================================================
// VERIFICATION CONTEXT
// ============================================================================

export interface VerificationInput {
  /** The behavior specification to verify */
  spec: BehaviorSpec;
  
  /** Input values passed to the behavior */
  input: Record<string, unknown>;
  
  /** Pre-execution state snapshot */
  preState: EntityStoreSnapshot;
  
  /** Post-execution entity store (current state) */
  postStore: EntityStore;
  
  /** Result of behavior execution (for success) */
  result?: unknown;
  
  /** Error from behavior execution (for failure) */
  error?: {
    code: string;
    message: string;
  };
  
  /** Domain definition for entity/type lookups */
  domain?: {
    name: string;
    entities: Array<{ name: string; fields: unknown[] }>;
    types: unknown[];
  };
  
  /** Current timestamp */
  now?: Date;
  
  /** Additional variables in scope */
  variables?: Record<string, unknown>;
}

// ============================================================================
// VERIFIER CLASS
// ============================================================================

/**
 * Verification bridge for ISL specs
 */
export class Verifier {
  private readonly evaluator: Evaluator;

  constructor() {
    this.evaluator = new Evaluator();
  }

  /**
   * Verify a behavior spec against actual execution results
   */
  verify(input: VerificationInput): VerificationResult {
    const startTime = Date.now();
    const failures: VerificationFailure[] = [];
    const preconditions: CheckResult[] = [];
    const postconditions: CheckResult[] = [];
    const invariants: CheckResult[] = [];

    // Build evaluation context
    const context = this.buildContext(input);

    // 1. Check preconditions (using pre-state)
    const preContext = this.buildPreContext(input);
    for (const pre of input.spec.preconditions) {
      const result = this.checkExpression(
        pre,
        preContext,
        'precondition'
      );
      preconditions.push(result);
      if (!result.passed) {
        failures.push(this.toFailure(result, pre.location));
      }
    }

    // 2. Check postconditions (using post-state with old() access to pre-state)
    const relevantPostconditions = this.getRelevantPostconditions(
      input.spec.postconditions,
      input.error
    );
    
    for (const post of relevantPostconditions) {
      for (const predicate of post.predicates) {
        const result = this.checkExpression(
          predicate,
          context,
          'postcondition'
        );
        postconditions.push(result);
        if (!result.passed) {
          failures.push(this.toFailure(result, predicate.location));
        }
      }
    }

    // 3. Check invariants (using post-state)
    for (const inv of input.spec.invariants) {
      const result = this.checkExpression(inv, context, 'invariant');
      invariants.push(result);
      if (!result.passed) {
        failures.push(this.toFailure(result, inv.location));
      }
    }

    return {
      passed: failures.length === 0,
      failures,
      preconditions,
      postconditions,
      invariants,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check a single expression
   */
  checkExpression(
    spec: ExpressionSpec,
    context: EvaluationContext,
    type: CheckType
  ): CheckResult {
    const startTime = Date.now();
    const exprString = expressionToString(spec.expression);
    
    try {
      const result = this.evaluator.evaluate(spec.expression, context);
      const passed = Boolean(result);
      
      return {
        type,
        name: spec.name ?? exprString,
        expression: exprString,
        passed,
        actual: result as unknown,
        expected: true,
        duration: Date.now() - startTime,
        location: spec.location,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      return {
        type,
        name: spec.name ?? exprString,
        expression: exprString,
        passed: false,
        error: error.message,
        duration: Date.now() - startTime,
        location: spec.location,
      };
    }
  }

  // ============================================================================
  // CONTEXT BUILDERS
  // ============================================================================

  private buildContext(input: VerificationInput): EvaluationContext {
    return {
      input: input.input,
      result: input.result,
      error: input.error
        ? {
            code: input.error.code,
            message: input.error.message,
            retriable: false,
          }
        : undefined,
      store: input.postStore,
      oldState: input.preState,
      domain: input.domain,
      now: input.now ?? new Date(),
      variables: new Map(Object.entries(input.variables ?? {})),
    };
  }

  private buildPreContext(input: VerificationInput): EvaluationContext {
    // For preconditions, we use pre-state without old() access
    const { SnapshotEntityStore } = require('./environment.js');
    
    return {
      input: input.input,
      result: undefined,
      error: undefined,
      store: new SnapshotEntityStore(input.preState),
      oldState: undefined,
      domain: input.domain,
      now: input.now ?? new Date(),
      variables: new Map(Object.entries(input.variables ?? {})),
    };
  }

  private getRelevantPostconditions(
    postconditions: PostconditionSpec[],
    error?: { code: string; message: string }
  ): PostconditionSpec[] {
    // Filter postconditions based on outcome
    return postconditions.filter((post) => {
      if (error) {
        // Error case: match 'any_error' or specific error code
        return post.condition === 'any_error' || post.condition === error.code;
      } else {
        // Success case: match 'success'
        return post.condition === 'success';
      }
    });
  }

  private toFailure(
    result: CheckResult,
    location: SourceLocation
  ): VerificationFailure {
    return {
      type: result.type,
      expression: result.expression,
      message: result.error ?? `Expected ${result.expected}, got ${result.actual}`,
      expected: result.expected,
      actual: result.actual,
      location: location,
    };
  }
}

// ============================================================================
// QUICK VERIFY FUNCTION
// ============================================================================

/**
 * Quick verification of a single expression
 */
export function verifyExpression(
  expression: unknown,
  context: {
    input?: Record<string, unknown>;
    result?: unknown;
    preState?: Record<string, Record<string, unknown>[]>;
    postState?: Record<string, Record<string, unknown>[]>;
    variables?: Record<string, unknown>;
  }
): { passed: boolean; value: Value; error?: string } {
  const evaluator = new Evaluator();
  
  // Build simple entity store from state objects
  const store = createSimpleStore(context.postState ?? {});
  const oldState = createSimpleSnapshot(context.preState ?? {});
  
  const evalContext: EvaluationContext = {
    input: context.input ?? {},
    result: context.result,
    error: undefined,
    store,
    oldState,
    domain: undefined,
    now: new Date(),
    variables: new Map(Object.entries(context.variables ?? {})),
  };
  
  try {
    const value = evaluator.evaluate(expression, evalContext);
    return {
      passed: Boolean(value),
      value,
    };
  } catch (err) {
    return {
      passed: false,
      value: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// HELPER: SIMPLE STORE
// ============================================================================

function createSimpleStore(
  state: Record<string, Record<string, unknown>[]>
): EntityStore {
  const entities = new Map<string, Map<string, Record<string, unknown>>>();
  
  for (const [entityName, instances] of Object.entries(state)) {
    const instanceMap = new Map<string, Record<string, unknown>>();
    for (const instance of instances) {
      const id = (instance['id'] as string) ?? `auto_${instanceMap.size}`;
      instanceMap.set(id, { ...instance, id });
    }
    entities.set(entityName, instanceMap);
  }
  
  return {
    getAll(entityName: string) {
      const map = entities.get(entityName);
      if (!map) return [];
      return Array.from(map.values()).map((data) => ({
        __entity__: entityName,
        __id__: data['id'] as string,
        ...data,
      }));
    },
    
    exists(entityName: string, criteria?: Record<string, unknown>) {
      const all = this.getAll(entityName);
      if (!criteria) return all.length > 0;
      return all.some((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    
    lookup(entityName: string, criteria: Record<string, unknown>) {
      const all = this.getAll(entityName);
      return all.find((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      );
    },
    
    count(entityName: string, criteria?: Record<string, unknown>) {
      const all = this.getAll(entityName);
      if (!criteria) return all.length;
      return all.filter((e) =>
        Object.entries(criteria).every(([k, v]) => e[k] === v)
      ).length;
    },
    
    create(entityName: string, data: Record<string, unknown>) {
      if (!entities.has(entityName)) {
        entities.set(entityName, new Map());
      }
      const map = entities.get(entityName)!;
      const id = (data['id'] as string) ?? `auto_${map.size}`;
      const instance = { ...data, id };
      map.set(id, instance);
      return { __entity__: entityName, __id__: id, ...instance };
    },
    
    update(entityName: string, id: string, data: Record<string, unknown>) {
      const map = entities.get(entityName);
      if (map) {
        const existing = map.get(id);
        if (existing) {
          Object.assign(existing, data);
        }
      }
    },
    
    delete(entityName: string, id: string) {
      const map = entities.get(entityName);
      if (map) {
        map.delete(id);
      }
    },
    
    snapshot(): EntityStoreSnapshot {
      const snapshot = new Map<string, Map<string, Record<string, unknown>>>();
      for (const [name, map] of entities) {
        snapshot.set(name, new Map(map));
      }
      return { entities: snapshot as unknown as Map<string, Map<string, import('./types.js').EntityInstance>>, timestamp: Date.now() };
    },
    
    restore(snapshot: EntityStoreSnapshot) {
      entities.clear();
      for (const [name, map] of snapshot.entities) {
        entities.set(name, new Map(map as unknown as Map<string, Record<string, unknown>>));
      }
    },
  };
}

function createSimpleSnapshot(
  state: Record<string, Record<string, unknown>[]>
): EntityStoreSnapshot {
  const entities = new Map<string, Map<string, Record<string, unknown>>>();
  
  for (const [entityName, instances] of Object.entries(state)) {
    const instanceMap = new Map<string, Record<string, unknown>>();
    for (const instance of instances) {
      const id = (instance['id'] as string) ?? `auto_${instanceMap.size}`;
      instanceMap.set(id, {
        __entity__: entityName,
        __id__: id,
        ...instance,
        id,
      });
    }
    entities.set(entityName, instanceMap);
  }
  
  return {
    entities: entities as unknown as Map<string, Map<string, import('./types.js').EntityInstance>>,
    timestamp: Date.now(),
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new verifier instance
 */
export function createVerifier(): Verifier {
  return new Verifier();
}
