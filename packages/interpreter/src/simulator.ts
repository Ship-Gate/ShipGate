// ============================================================================
// ISL Runtime Simulator - Minimal interpreter for simulation/testing
// @isl-lang/interpreter/simulator
// ============================================================================

import type { Domain as ASTDomain, Behavior, Expression as ASTExpression } from '@isl-lang/parser';
import type { Value } from '@isl-lang/runtime-interpreter';
import { evaluate } from '@isl-lang/runtime-interpreter';
import type { Environment, ExecutionContext } from '@isl-lang/runtime-interpreter';
import { runWithTimeout } from './sandbox';
import { toValue, fromValue, createBindings } from './bindings';
import type { Bindings, TestData } from './types';
import { InterpreterError } from './types';

// ============================================================================
// SIMULATOR CONFIGURATION
// ============================================================================

export interface SimulatorOptions {
  /** Timeout per expression evaluation in milliseconds */
  timeout: number;
  
  /** Enable sandboxing (no filesystem/network by default) */
  sandbox: boolean;
  
  /** Allow filesystem access (only if sandbox enabled) */
  allowFs: boolean;
  
  /** Allow network access (only if sandbox enabled) */
  allowNet: boolean;
  
  /** Maximum evaluation depth */
  maxDepth: number;
  
  /** Verbose logging */
  verbose: boolean;
}

export const DEFAULT_SIMULATOR_OPTIONS: SimulatorOptions = {
  timeout: 5000,
  sandbox: true,
  allowFs: false,
  allowNet: false,
  maxDepth: 1000,
  verbose: false,
};

// ============================================================================
// SIMULATION RESULT
// ============================================================================

export interface SimulationResult {
  /** Behavior name */
  behavior: string;
  
  /** Whether simulation passed */
  passed: boolean;
  
  /** Precondition evaluation results */
  preconditions: ConditionEvaluation[];
  
  /** Postcondition evaluation results */
  postconditions: ConditionEvaluation[];
  
  /** Entity validation results */
  entityValidations: EntityValidation[];
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Any errors encountered */
  errors: string[];
}

export interface ConditionEvaluation {
  /** Expression string */
  expression: string;
  
  /** Whether condition passed */
  passed: boolean;
  
  /** Evaluated value */
  value: unknown;
  
  /** Error if evaluation failed */
  error?: string;
  
  /** Duration in milliseconds */
  duration: number;
}

export interface EntityValidation {
  /** Entity name */
  entity: string;
  
  /** Whether validation passed */
  passed: boolean;
  
  /** Validation errors */
  errors: string[];
}

// ============================================================================
// SIMULATOR CLASS
// ============================================================================

export class RuntimeSimulator {
  private domain: ASTDomain | null = null;
  private options: SimulatorOptions;

  constructor(options: Partial<SimulatorOptions> = {}) {
    this.options = { ...DEFAULT_SIMULATOR_OPTIONS, ...options };
  }

  /**
   * Load an ISL domain specification
   */
  setDomain(domain: ASTDomain): void {
    this.domain = domain;
  }

  /**
   * Simulate a behavior execution with given test data
   */
  async simulate(behaviorName: string, testData: TestData): Promise<SimulationResult> {
    if (!this.domain) {
      throw new InterpreterError('No domain loaded. Call setDomain() first.', 'NO_DOMAIN');
    }

    const behavior = this.domain.behaviors.find((b) => b.name.name === behaviorName);
    if (!behavior) {
      throw new InterpreterError(
        `Behavior "${behaviorName}" not found in domain`,
        'BEHAVIOR_NOT_FOUND',
        { behaviorName, available: this.domain.behaviors.map((b) => b.name.name) }
      );
    }

    const startTime = performance.now();
    const errors: string[] = [];
    const bindings = createBindings(testData);

    // Evaluate preconditions
    const preconditionResults = await this.evaluateConditions(
      behavior.preconditions,
      bindings,
      'pre',
      'precondition'
    );

    // Evaluate postconditions (if post-state is provided)
    let postconditionResults: ConditionEvaluation[] = [];
    if (testData.bindings.post) {
      postconditionResults = await this.evaluateConditions(
        behavior.postconditions.flatMap((pc) => pc.predicates),
        bindings,
        'post',
        'postcondition'
      );
    }

    // Validate entities
    const entityValidations = await this.validateEntities(bindings, errors);

    const duration = performance.now() - startTime;
    const passed =
      preconditionResults.every((r) => r.passed) &&
      postconditionResults.every((r) => r.passed) &&
      entityValidations.every((v) => v.passed);

    return {
      behavior: behaviorName,
      passed,
      preconditions: preconditionResults,
      postconditions: postconditionResults,
      entityValidations,
      duration,
      errors,
    };
  }

  /**
   * Evaluate a list of conditions
   */
  private async evaluateConditions(
    conditions: ASTExpression[],
    bindings: Bindings,
    phase: 'pre' | 'post',
    type: 'precondition' | 'postcondition'
  ): Promise<ConditionEvaluation[]> {
    const results: ConditionEvaluation[] = [];
    const env = this.createEnvironment(bindings, phase);
    const ctx = this.createExecutionContext();

    for (const condition of conditions) {
      const exprStr = this.expressionToString(condition);
      const startTime = performance.now();

      try {
        const runtimeExpr = this.convertExpression(condition, bindings);
        
        const sandboxResult = await runWithTimeout(
          () => evaluate(runtimeExpr, env, ctx),
          this.options.timeout
        );

        if (sandboxResult.timedOut) {
          results.push({
            expression: exprStr,
            passed: false,
            value: undefined,
            error: `Timeout after ${this.options.timeout}ms`,
            duration: sandboxResult.duration,
          });
          continue;
        }

        if (!sandboxResult.success) {
          results.push({
            expression: exprStr,
            passed: false,
            value: undefined,
            error: sandboxResult.error?.message ?? 'Evaluation failed',
            duration: sandboxResult.duration,
          });
          continue;
        }

        const value = sandboxResult.value!;
        const boolValue = this.toBoolean(value);

        results.push({
          expression: exprStr,
          passed: boolValue,
          value: fromValue(value),
          duration: performance.now() - startTime,
        });
      } catch (error) {
        results.push({
          expression: exprStr,
          passed: false,
          value: undefined,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Validate entities against their invariants
   */
  private async validateEntities(
    bindings: Bindings,
    errors: string[]
  ): Promise<EntityValidation[]> {
    if (!this.domain) return [];

    const validations: EntityValidation[] = [];

    for (const entity of this.domain.entities) {
      const entityErrors: string[] = [];

      // Check invariants if any
      if (entity.invariants && entity.invariants.length > 0) {
        const env = this.createEnvironment(bindings, 'pre');
        const ctx = this.createExecutionContext();

        for (const invariant of entity.invariants) {
          try {
            const runtimeExpr = this.convertExpression(invariant, bindings);
            const result = await runWithTimeout(
              () => evaluate(runtimeExpr, env, ctx),
              this.options.timeout
            );

            if (result.success && result.value) {
              const boolValue = this.toBoolean(result.value);
              if (!boolValue) {
                entityErrors.push(`Invariant violated: ${this.expressionToString(invariant)}`);
              }
            } else {
              entityErrors.push(`Failed to evaluate invariant: ${this.expressionToString(invariant)}`);
            }
          } catch (error) {
            entityErrors.push(
              `Error evaluating invariant: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      validations.push({
        entity: entity.name.name,
        passed: entityErrors.length === 0,
        errors: entityErrors,
      });
    }

    return validations;
  }

  /**
   * Create an evaluation environment from bindings
   */
  private createEnvironment(bindings: Bindings, phase: 'pre' | 'post'): Environment {
    const env: Environment = {
      parent: null,
      bindings: new Map(phase === 'pre' ? bindings.pre : bindings.post),
      types: new Map(),
      effects: new Map(),
    };

    // Add 'old' values for postcondition evaluation
    if (phase === 'post') {
      for (const [key, value] of bindings.old) {
        env.bindings.set(`__old_${key}`, value);
      }

      if (bindings.result) {
        env.bindings.set('result', bindings.result);
      }
    }

    return env;
  }

  /**
   * Create an execution context
   */
  private createExecutionContext(): ExecutionContext {
    return {
      domain: {
        name: this.domain?.name.name ?? 'unknown',
        version: '1.0.0',
        types: new Map(),
        entities: new Map(),
        behaviors: new Map(),
        invariants: new Map(),
        views: new Map(),
      },
      environment: {
        parent: null,
        bindings: new Map(),
        types: new Map(),
        effects: new Map(),
      },
      stack: [],
      entities: {
        get: () => undefined,
        set: () => {},
        delete: () => false,
        query: () => [],
      },
      events: [],
      trace: [],
      contractMode: 'check',
    };
  }

  /**
   * Convert AST expression to runtime expression
   */
  private convertExpression(expr: ASTExpression, bindings: Bindings): any {
    switch (expr.kind) {
      case 'Identifier':
        return { tag: 'identifier', name: expr.name };

      case 'StringLiteral':
        return { tag: 'literal', value: { tag: 'string', value: expr.value } };

      case 'NumberLiteral':
        return {
          tag: 'literal',
          value: expr.isFloat
            ? { tag: 'float', value: expr.value }
            : { tag: 'int', value: BigInt(Math.floor(expr.value)) },
        };

      case 'BooleanLiteral':
        return { tag: 'literal', value: { tag: 'boolean', value: expr.value } };

      case 'NullLiteral':
        return { tag: 'literal', value: { tag: 'option', value: null } };

      case 'BinaryExpr':
        return {
          tag: 'binary',
          op: this.convertOperator(expr.operator),
          left: this.convertExpression(expr.left, bindings),
          right: this.convertExpression(expr.right, bindings),
        };

      case 'UnaryExpr':
        return {
          tag: 'unary',
          op: expr.operator,
          operand: this.convertExpression(expr.operand, bindings),
        };

      case 'MemberExpr':
        return {
          tag: 'member',
          object: this.convertExpression(expr.object, bindings),
          field: expr.property.name,
        };

      case 'CallExpr':
        return {
          tag: 'call',
          fn: this.convertExpression(expr.callee, bindings),
          args: expr.arguments.map((a) => this.convertExpression(a, bindings)),
        };

      case 'OldExpr':
        if (expr.expression.kind === 'Identifier') {
          return { tag: 'identifier', name: `__old_${expr.expression.name}` };
        }
        return { tag: 'old', expression: this.convertExpression(expr.expression, bindings) };

      case 'ResultExpr':
        if (expr.property) {
          return {
            tag: 'member',
            object: { tag: 'result' },
            field: expr.property.name,
          };
        }
        return { tag: 'result' };

      case 'InputExpr':
        return { tag: 'identifier', name: expr.property.name };

      default:
        throw new InterpreterError(
          `Unsupported expression kind: ${expr.kind}`,
          'UNSUPPORTED_EXPRESSION'
        );
    }
  }

  /**
   * Convert operator string to runtime operator
   */
  private convertOperator(op: string): string {
    const mapping: Record<string, string> = {
      'and': '&&',
      'or': '||',
      'implies': '||',
      'iff': '==',
    };
    return mapping[op] ?? op;
  }

  /**
   * Convert expression to string for display
   */
  private expressionToString(expr: ASTExpression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'NullLiteral':
        return 'null';
      case 'BinaryExpr':
        return `${this.expressionToString(expr.left)} ${expr.operator} ${this.expressionToString(expr.right)}`;
      case 'UnaryExpr':
        return `${expr.operator}${this.expressionToString(expr.operand)}`;
      case 'MemberExpr':
        return `${this.expressionToString(expr.object)}.${expr.property.name}`;
      case 'CallExpr':
        return `${this.expressionToString(expr.callee)}(${expr.arguments.map((a) => this.expressionToString(a)).join(', ')})`;
      case 'OldExpr':
        return `old(${this.expressionToString(expr.expression)})`;
      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';
      case 'InputExpr':
        return `input.${expr.property.name}`;
      default:
        return '<expression>';
    }
  }

  /**
   * Convert a Value to boolean
   */
  private toBoolean(value: Value): boolean {
    switch (value.tag) {
      case 'boolean':
        return value.value;
      case 'int':
        return value.value !== BigInt(0);
      case 'float':
        return value.value !== 0;
      case 'string':
        return value.value.length > 0;
      case 'option':
        return value.value !== null;
      default:
        return true; // Non-boolean values are truthy
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Simulate a behavior with test data
 */
export async function simulate(
  domain: ASTDomain,
  behaviorName: string,
  testData: TestData,
  options?: Partial<SimulatorOptions>
): Promise<SimulationResult> {
  const simulator = new RuntimeSimulator(options);
  simulator.setDomain(domain);
  return simulator.simulate(behaviorName, testData);
}
