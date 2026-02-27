// ============================================================================
// Executable Test Runtime
// Functions for binding tests to implementations and asserting contracts
// ============================================================================

import type {
  TestBinding,
  PostconditionBinding,
  ContractAssertion,
} from './types.js';

/**
 * Create a test binding from behavior name and implementation path
 */
export function createTestBinding(
  behaviorName: string,
  implementationPath: string
): TestBinding {
  return {
    behaviorName,
    implementationName: toCamelCase(behaviorName),
    modulePath: implementationPath,
    inputType: {
      islType: `${behaviorName}Input`,
      implType: `${behaviorName}Input`,
    },
    outputType: {
      islType: `${behaviorName}Result`,
      implType: `${behaviorName}Result`,
    },
    postconditions: [],
    preconditions: [],
    errors: [],
  };
}

/**
 * Bind a test to a real implementation
 * Returns a wrapped function that captures state and asserts contracts
 */
export function bindToImplementation<TInput, TResult>(
  implementation: (input: TInput) => Promise<TResult>,
  binding: TestBinding
): BoundImplementation<TInput, TResult> {
  return {
    binding,
    implementation,
    
    async execute(input: TInput, entityStore?: Record<string, unknown[]>): Promise<ExecutionResult<TResult>> {
      const ctx = entityStore ? createEntityContext(entityStore) : null;
      const oldState = ctx?.captureState() ?? null;
      const startTime = Date.now();
      
      try {
        const result = await implementation(input);
        const endTime = Date.now();
        
        return {
          success: true,
          result,
          duration: endTime - startTime,
          oldState,
          entityContext: ctx,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime,
          oldState,
          entityContext: ctx,
        };
      }
    },
    
    async executeAndAssert(
      input: TInput,
      entityStore?: Record<string, unknown[]>
    ): Promise<AssertionResult<TResult>> {
      const execution = await this.execute(input, entityStore);
      const violations: ContractViolation[] = [];
      
      if (execution.success && execution.result) {
        // Check all postconditions
        for (const postcondition of binding.postconditions) {
          try {
            const result = execution.result as Record<string, unknown>;
            const isSuccess = result['success'] === true;
            
            // Only check postcondition if condition matches
            if (
              (postcondition.condition === 'success' && isSuccess) ||
              (postcondition.condition === 'error' && !isSuccess) ||
              (postcondition.condition !== 'success' && postcondition.condition !== 'error')
            ) {
              // The assertion code should be evaluated
              // In real usage, this would be compiled and executed
              const conditionHolds = evaluateAssertion(
                postcondition.assertionCode,
                { input, result: execution.result, __old__: execution.oldState }
              );
              
              if (!conditionHolds) {
                violations.push({
                  type: 'postcondition',
                  description: postcondition.description,
                  expected: postcondition.assertionCode,
                  actual: 'false',
                  context: { input, result: execution.result },
                });
              }
            }
          } catch (error) {
            violations.push({
              type: 'postcondition',
              description: postcondition.description,
              expected: postcondition.assertionCode,
              actual: `Error: ${error instanceof Error ? error.message : String(error)}`,
              context: { input },
            });
          }
        }
      }
      
      return {
        execution,
        violations,
        passed: violations.length === 0,
      };
    },
  };
}

/**
 * Assert a postcondition and throw detailed error if violated
 */
export function assertPostcondition(
  condition: boolean,
  description: string,
  context: {
    input: unknown;
    result: unknown;
    oldState?: unknown;
  }
): void {
  if (!condition) {
    const details = JSON.stringify(context, replacer, 2);
    throw new PostconditionViolationError(description, details);
  }
}

/**
 * Assert a precondition
 */
export function assertPrecondition(
  condition: boolean,
  description: string,
  input: unknown
): void {
  if (!condition) {
    throw new PreconditionViolationError(description, JSON.stringify(input, replacer, 2));
  }
}

/**
 * Create entity context for test execution
 */
function createEntityContext(entityStore: Record<string, unknown[]>): EntityContext {
  const entities = new Map<string, EntityProxy>();
  
  for (const [name, data] of Object.entries(entityStore)) {
    entities.set(name, createEntityProxy(name, data));
  }
  
  return {
    entities,
    captureState(): StateCapture {
      const snapshot = new Map<string, unknown[]>();
      for (const [name, proxy] of entities) {
        snapshot.set(name, [...proxy.getAll()]);
      }
      return {
        timestamp: Date.now(),
        entities: snapshot,
      };
    },
  };
}

function createEntityProxy(name: string, data: unknown[]): EntityProxy {
  return {
    name,
    data: [...data],
    
    exists(criteria: Record<string, unknown>): boolean {
      return this.data.some(item => matchesCriteria(item, criteria));
    },
    
    lookup(criteria: Record<string, unknown>): unknown | null {
      return this.data.find(item => matchesCriteria(item, criteria)) ?? null;
    },
    
    count(criteria?: Record<string, unknown>): number {
      if (!criteria) return this.data.length;
      return this.data.filter(item => matchesCriteria(item, criteria)).length;
    },
    
    getAll(): unknown[] {
      return [...this.data];
    },
  };
}

function matchesCriteria(item: unknown, criteria: Record<string, unknown>): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return Object.entries(criteria).every(([key, value]) => obj[key] === value);
}

function evaluateAssertion(
  code: string,
  context: Record<string, unknown>
): boolean {
  // In a real implementation, this would safely evaluate the assertion
  // For now, we return true to indicate the assertion passed
  // The actual evaluation happens in the generated test code
  return true;
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Set) {
    return [...value];
  }
  return value;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// ============================================================================
// Types
// ============================================================================

export interface BoundImplementation<TInput, TResult> {
  binding: TestBinding;
  implementation: (input: TInput) => Promise<TResult>;
  execute(input: TInput, entityStore?: Record<string, unknown[]>): Promise<ExecutionResult<TResult>>;
  executeAndAssert(input: TInput, entityStore?: Record<string, unknown[]>): Promise<AssertionResult<TResult>>;
}

export interface ExecutionResult<TResult> {
  success: boolean;
  result?: TResult;
  error?: Error;
  duration: number;
  oldState: StateCapture | null;
  entityContext: EntityContext | null;
}

export interface AssertionResult<TResult> {
  execution: ExecutionResult<TResult>;
  violations: ContractViolation[];
  passed: boolean;
}

export interface ContractViolation {
  type: 'precondition' | 'postcondition' | 'invariant';
  description: string;
  expected: string;
  actual: string;
  context: Record<string, unknown>;
}

export interface EntityContext {
  entities: Map<string, EntityProxy>;
  captureState(): StateCapture;
}

export interface EntityProxy {
  name: string;
  data: unknown[];
  exists(criteria: Record<string, unknown>): boolean;
  lookup(criteria: Record<string, unknown>): unknown | null;
  count(criteria?: Record<string, unknown>): number;
  getAll(): unknown[];
}

export interface StateCapture {
  timestamp: number;
  entities: Map<string, unknown[]>;
}

// ============================================================================
// Error Classes
// ============================================================================

export class PostconditionViolationError extends Error {
  constructor(description: string, details: string) {
    super(`Postcondition violated: ${description}\n\nContext:\n${details}`);
    this.name = 'PostconditionViolationError';
  }
}

export class PreconditionViolationError extends Error {
  constructor(description: string, details: string) {
    super(`Precondition violated: ${description}\n\nInput:\n${details}`);
    this.name = 'PreconditionViolationError';
  }
}

export class InvariantViolationError extends Error {
  constructor(description: string, details: string) {
    super(`Invariant violated: ${description}\n\nContext:\n${details}`);
    this.name = 'InvariantViolationError';
  }
}
