// ============================================================================
// ISL Interpreter - Core Execution Engine
// @isl-lang/interpreter/interpreter
// ============================================================================

import { readFile } from 'node:fs/promises';
import type {
  Value,
  Environment,
  ExecutionContext,
  Expression as RuntimeExpression,
} from '@isl-lang/runtime-interpreter';
import { evaluate } from '@isl-lang/runtime-interpreter';
import type {
  Domain as ASTDomain,
  Behavior,
  Expression as ASTExpression,
  Statement,
  Scenario,
} from '@isl-lang/parser';
import type {
  VerificationOptions,
  VerificationReport,
  BehaviorResult,
  ConditionResult,
  CheckResult,
  ExecutionPlan,
  BehaviorPlan,
  Bindings,
  TestData,
  ScenarioTestData,
} from './types';
import {
  DEFAULT_OPTIONS,
  InterpreterError,
  BindingError,
} from './types';
import {
  loadBindings,
  createBindings,
  toValue,
  fromValue,
  loadTargetModule,
} from './bindings';
import { runWithTimeout } from './sandbox';
import {
  executeFunction,
  executeBehavior,
  captureState,
  cloneValues,
} from './executor';
import { runScenarios, ScenarioContext } from './scenarios';

// ============================================================================
// INTERPRETER CLASS
// ============================================================================

export class ISLInterpreter {
  private options: VerificationOptions;
  private domain: ASTDomain | null = null;
  private parseFn: ((source: string) => ASTDomain) | null = null;
  private typeCheckFn: ((domain: ASTDomain) => void) | null = null;
  
  constructor(options: Partial<VerificationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Set the parser function.
   */
  setParser(parseFn: (source: string) => ASTDomain): void {
    this.parseFn = parseFn;
  }
  
  /**
   * Set the type checker function.
   */
  setTypeChecker(typeCheckFn: (domain: ASTDomain) => void): void {
    this.typeCheckFn = typeCheckFn;
  }
  
  /**
   * Load and parse an ISL spec.
   */
  async loadSpec(specPath: string): Promise<ASTDomain> {
    const source = await readFile(specPath, 'utf-8');
    
    if (!this.parseFn) {
      // Try to dynamically import the parser
      try {
        const { parse } = await import('@isl-lang/parser');
        this.parseFn = parse;
      } catch {
        throw new InterpreterError(
          'Parser not available. Call setParser() or install @isl-lang/parser',
          'PARSER_NOT_AVAILABLE'
        );
      }
    }
    
    this.domain = this.parseFn(source);
    
    // Optionally type check
    if (this.typeCheckFn) {
      this.typeCheckFn(this.domain);
    }
    
    return this.domain;
  }
  
  /**
   * Set the domain directly (for already-parsed specs).
   */
  setDomain(domain: ASTDomain): void {
    this.domain = domain;
  }
  
  /**
   * Create an execution plan from the loaded spec.
   */
  createExecutionPlan(): ExecutionPlan {
    if (!this.domain) {
      throw new InterpreterError('No spec loaded. Call loadSpec() first', 'NO_SPEC');
    }
    
    const behaviorPlans: BehaviorPlan[] = this.domain.behaviors.map((behavior) => {
      // Find scenarios for this behavior
      const scenarioBlock = this.domain!.scenarios.find(
        (s) => s.behaviorName.name === behavior.name.name
      );
      
      return {
        behavior,
        preconditions: behavior.preconditions,
        postconditions: behavior.postconditions.map((pc) => ({
          condition: typeof pc.condition === 'string' ? pc.condition : pc.condition.name,
          predicates: pc.predicates,
        })),
        invariants: behavior.invariants,
        scenarios: scenarioBlock?.scenarios ?? [],
      };
    });
    
    return {
      domain: this.domain,
      behaviors: behaviorPlans,
      options: this.options,
    };
  }
  
  /**
   * Verify a specific behavior against test data.
   */
  async verifyBehavior(
    behaviorName: string,
    testData: TestData,
    targetPath?: string
  ): Promise<BehaviorResult> {
    if (!this.domain) {
      throw new InterpreterError('No spec loaded. Call loadSpec() first', 'NO_SPEC');
    }
    
    const behavior = this.domain.behaviors.find((b) => b.name.name === behaviorName);
    if (!behavior) {
      throw new InterpreterError(`Behavior "${behaviorName}" not found in spec`, 'BEHAVIOR_NOT_FOUND');
    }
    
    const startTime = performance.now();
    const bindings = createBindings(testData);
    
    // Verify preconditions
    const preconditionResults = await this.verifyConditions(
      behavior.preconditions,
      'precondition',
      bindings,
      'pre'
    );
    
    // For dynamic mode, execute the function
    if (this.options.mode === 'dynamic' && targetPath) {
      await executeBehavior(behaviorName, targetPath, bindings, this.options);
    }
    
    // Verify postconditions
    const postconditionResults: ConditionResult[] = [];
    for (const pc of behavior.postconditions) {
      const condition = typeof pc.condition === 'string' ? pc.condition : pc.condition.name;
      const results = await this.verifyConditions(
        pc.predicates,
        'postcondition',
        bindings,
        'post'
      );
      postconditionResults.push(...results);
    }
    
    // Verify invariants
    const invariantResults = await this.verifyConditions(
      behavior.invariants,
      'invariant',
      bindings,
      'post'
    );
    
    // Run scenarios
    const scenarioBlock = this.domain.scenarios.find(
      (s) => s.behaviorName.name === behaviorName
    );
    const scenarioResults = scenarioBlock
      ? await this.runBehaviorScenarios(scenarioBlock.scenarios, testData.scenarios, bindings)
      : [];
    
    const allPassed =
      preconditionResults.every((r) => r.result.status === 'passed') &&
      postconditionResults.every((r) => r.result.status === 'passed') &&
      invariantResults.every((r) => r.result.status === 'passed') &&
      scenarioResults.every((r) => r.passed);
    
    return {
      behavior: behaviorName,
      description: behavior.description?.value,
      preconditions: preconditionResults,
      postconditions: postconditionResults,
      invariants: invariantResults,
      scenarios: scenarioResults,
      duration: performance.now() - startTime,
      passed: allPassed,
    };
  }
  
  /**
   * Verify all behaviors against test data.
   */
  async verify(
    specPath: string,
    testDataPath: string,
    targetPath?: string
  ): Promise<VerificationReport> {
    const startTime = performance.now();
    const warnings: string[] = [];
    
    // Load spec
    await this.loadSpec(specPath);
    
    // Load test data
    const testData = await loadBindings({ type: 'json', path: testDataPath });
    
    // Find the behavior to verify
    const behavior = this.domain!.behaviors.find((b) => b.name.name === testData.intent);
    if (!behavior) {
      throw new InterpreterError(
        `Behavior "${testData.intent}" not found in spec. ` +
        `Available behaviors: ${this.domain!.behaviors.map((b) => b.name.name).join(', ')}`,
        'BEHAVIOR_NOT_FOUND'
      );
    }
    
    // Verify the behavior
    const behaviorResult = await this.verifyBehavior(testData.intent, testData, targetPath);
    
    // Build report
    const summary = this.calculateSummary([behaviorResult]);
    
    return {
      specPath,
      targetPath,
      testDataPath,
      mode: this.options.mode,
      behaviors: [behaviorResult],
      summary,
      duration: performance.now() - startTime,
      timestamp: new Date(),
      warnings,
    };
  }
  
  /**
   * Verify conditions (preconditions, postconditions, or invariants).
   */
  private async verifyConditions(
    conditions: ASTExpression[],
    type: ConditionResult['type'],
    bindings: Bindings,
    phase: 'pre' | 'post'
  ): Promise<ConditionResult[]> {
    const results: ConditionResult[] = [];
    const env = this.createEnvironment(bindings, phase);
    const ctx = this.createExecutionContext();
    
    for (const condition of conditions) {
      const startTime = performance.now();
      const exprStr = this.stringifyExpression(condition);
      
      try {
        // Convert AST expression to runtime expression
        const runtimeExpr = this.convertExpression(condition, bindings);
        
        // Evaluate with timeout
        const sandboxResult = await runWithTimeout(
          () => evaluate(runtimeExpr, env, ctx),
          this.options.timeout
        );
        
        if (sandboxResult.timedOut) {
          results.push({
            type,
            expression: exprStr,
            result: {
              status: 'error',
              message: `Timeout evaluating ${type}`,
              error: new Error(`Evaluation timed out after ${this.options.timeout}ms`),
            },
            duration: sandboxResult.duration,
          });
          continue;
        }
        
        if (!sandboxResult.success) {
          results.push({
            type,
            expression: exprStr,
            result: {
              status: 'error',
              message: `Error evaluating ${type}`,
              error: sandboxResult.error!,
            },
            duration: sandboxResult.duration,
          });
          continue;
        }
        
        const value = sandboxResult.value!;
        
        if (value.tag !== 'boolean') {
          results.push({
            type,
            expression: exprStr,
            result: {
              status: 'failed',
              message: `${type} must evaluate to boolean, got ${value.tag}`,
              expected: 'boolean',
              actual: value.tag,
            },
            duration: performance.now() - startTime,
          });
          continue;
        }
        
        if (value.value) {
          results.push({
            type,
            expression: exprStr,
            result: {
              status: 'passed',
              message: exprStr,
              values: this.collectExpressionValues(condition, env),
            },
            duration: performance.now() - startTime,
          });
        } else {
          results.push({
            type,
            expression: exprStr,
            result: {
              status: 'failed',
              message: `${type} failed: ${exprStr}`,
              expected: true,
              actual: false,
              values: this.collectExpressionValues(condition, env),
            },
            duration: performance.now() - startTime,
          });
        }
      } catch (error) {
        results.push({
          type,
          expression: exprStr,
          result: {
            status: 'error',
            message: `Error evaluating ${type}: ${(error as Error).message}`,
            error: error instanceof Error ? error : new Error(String(error)),
          },
          duration: performance.now() - startTime,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Run scenarios for a behavior.
   */
  private async runBehaviorScenarios(
    scenarios: Scenario[],
    testData: ScenarioTestData[] | undefined,
    bindings: Bindings
  ): Promise<BehaviorResult['scenarios']> {
    const ctx: ScenarioContext = {
      bindings,
      evaluate: async (expr, env) => {
        const runtimeExpr = this.convertExpression(expr, bindings);
        return evaluate(runtimeExpr, env, this.createExecutionContext());
      },
      execute: async (stmt, env) => {
        await this.executeStatement(stmt, env, bindings);
      },
      createEnvironment: (b) => this.createEnvironment(b, 'pre'),
      options: this.options,
    };
    
    return runScenarios(scenarios, testData, ctx);
  }
  
  /**
   * Create an environment from bindings.
   */
  private createEnvironment(bindings: Bindings, phase: 'pre' | 'post'): Environment {
    const env: Environment = {
      parent: null,
      bindings: new Map(phase === 'pre' ? bindings.pre : bindings.post),
      types: new Map(),
      effects: new Map(),
    };
    
    // Add 'old' values to environment for postcondition evaluation
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
   * Create an execution context.
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
   * Convert an AST expression to a runtime expression.
   */
  private convertExpression(expr: ASTExpression, bindings: Bindings): RuntimeExpression {
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
      
      case 'CallExpr':
        return {
          tag: 'call',
          fn: this.convertExpression(expr.callee, bindings),
          args: expr.arguments.map((a) => this.convertExpression(a, bindings)),
        };
      
      case 'MemberExpr':
        return {
          tag: 'member',
          object: this.convertExpression(expr.object, bindings),
          field: expr.property.name,
        };
      
      case 'IndexExpr':
        return {
          tag: 'index',
          collection: this.convertExpression(expr.object, bindings),
          index: this.convertExpression(expr.index, bindings),
        };
      
      case 'OldExpr':
        // Convert old(x) to __old_x lookup
        if (expr.expression.kind === 'Identifier') {
          return { tag: 'identifier', name: `__old_${expr.expression.name}` };
        }
        if (expr.expression.kind === 'MemberExpr') {
          // old(x.y) -> __old_x.y
          const obj = expr.expression.object;
          if (obj.kind === 'Identifier') {
            return {
              tag: 'member',
              object: { tag: 'identifier', name: `__old_${obj.name}` },
              field: expr.expression.property.name,
            };
          }
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
      
      case 'ConditionalExpr':
        return {
          tag: 'conditional',
          condition: this.convertExpression(expr.condition, bindings),
          then: this.convertExpression(expr.thenBranch, bindings),
          else: this.convertExpression(expr.elseBranch, bindings),
        };
      
      case 'QuantifierExpr':
        return {
          tag: 'quantifier',
          kind: expr.quantifier === 'all' ? 'forall' : 'exists',
          variable: expr.variable.name,
          domain: this.convertExpression(expr.collection, bindings),
          body: this.convertExpression(expr.predicate, bindings),
        };
      
      case 'ListExpr':
        return {
          tag: 'list_construct',
          elements: expr.elements.map((e) => this.convertExpression(e, bindings)),
        };
      
      case 'MapExpr':
        return {
          tag: 'map_construct',
          entries: expr.entries.map((e) => ({
            key: this.convertExpression(e.key, bindings),
            value: this.convertExpression(e.value, bindings),
          })),
        };
      
      case 'QualifiedName':
        // Convert a.b.c to member access chain
        let result: RuntimeExpression = { tag: 'identifier', name: expr.parts[0]!.name };
        for (let i = 1; i < expr.parts.length; i++) {
          result = { tag: 'member', object: result, field: expr.parts[i]!.name };
        }
        return result;
      
      default:
        throw new InterpreterError(`Unsupported expression kind: ${expr.kind}`, 'UNSUPPORTED_EXPRESSION');
    }
  }
  
  /**
   * Convert an AST operator to a runtime operator.
   */
  private convertOperator(op: string): string {
    const mapping: Record<string, string> = {
      'and': '&&',
      'or': '||',
      'implies': '||', // a implies b = !a || b (simplified)
      'iff': '==',
    };
    return mapping[op] ?? op;
  }
  
  /**
   * Execute a statement.
   */
  private async executeStatement(
    stmt: Statement,
    env: Environment,
    bindings: Bindings
  ): Promise<void> {
    switch (stmt.kind) {
      case 'AssignmentStmt': {
        const value = await evaluate(
          this.convertExpression(stmt.value, bindings),
          env,
          this.createExecutionContext()
        );
        env.bindings.set(stmt.target.name, value);
        bindings.pre.set(stmt.target.name, value);
        break;
      }
      
      case 'CallStmt': {
        const result = await evaluate(
          this.convertExpression(stmt.call, bindings),
          env,
          this.createExecutionContext()
        );
        if (stmt.target) {
          env.bindings.set(stmt.target.name, result);
          bindings.pre.set(stmt.target.name, result);
        }
        break;
      }
      
      case 'LoopStmt': {
        const countValue = await evaluate(
          this.convertExpression(stmt.count, bindings),
          env,
          this.createExecutionContext()
        );
        if (countValue.tag !== 'int') {
          throw new InterpreterError('Loop count must be an integer', 'TYPE_ERROR');
        }
        const count = Number(countValue.value);
        for (let i = 0; i < count; i++) {
          if (stmt.variable) {
            env.bindings.set(stmt.variable.name, { tag: 'int', value: BigInt(i) });
          }
          for (const bodyStmt of stmt.body) {
            await this.executeStatement(bodyStmt, env, bindings);
          }
        }
        break;
      }
    }
  }
  
  /**
   * Stringify an expression for display.
   */
  private stringifyExpression(expr: ASTExpression): string {
    switch (expr.kind) {
      case 'Identifier':
        return expr.name;
      case 'QualifiedName':
        return expr.parts.map((p) => p.name).join('.');
      case 'StringLiteral':
        return `"${expr.value}"`;
      case 'NumberLiteral':
        return String(expr.value);
      case 'BooleanLiteral':
        return String(expr.value);
      case 'NullLiteral':
        return 'null';
      case 'BinaryExpr':
        return `${this.stringifyExpression(expr.left)} ${expr.operator} ${this.stringifyExpression(expr.right)}`;
      case 'UnaryExpr':
        return `${expr.operator}${this.stringifyExpression(expr.operand)}`;
      case 'CallExpr':
        return `${this.stringifyExpression(expr.callee)}(${expr.arguments.map((a) => this.stringifyExpression(a)).join(', ')})`;
      case 'MemberExpr':
        return `${this.stringifyExpression(expr.object)}.${expr.property.name}`;
      case 'IndexExpr':
        return `${this.stringifyExpression(expr.object)}[${this.stringifyExpression(expr.index)}]`;
      case 'OldExpr':
        return `old(${this.stringifyExpression(expr.expression)})`;
      case 'ResultExpr':
        return expr.property ? `result.${expr.property.name}` : 'result';
      case 'InputExpr':
        return `input.${expr.property.name}`;
      default:
        return '<expression>';
    }
  }
  
  /**
   * Collect values referenced in an expression.
   */
  private collectExpressionValues(
    expr: ASTExpression,
    env: Environment
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    this.collectValuesRecursive(expr, env, values);
    return values;
  }
  
  private collectValuesRecursive(
    expr: ASTExpression,
    env: Environment,
    values: Record<string, unknown>
  ): void {
    switch (expr.kind) {
      case 'Identifier': {
        const value = env.bindings.get(expr.name);
        if (value !== undefined) {
          values[expr.name] = fromValue(value);
        }
        break;
      }
      case 'BinaryExpr':
        this.collectValuesRecursive(expr.left, env, values);
        this.collectValuesRecursive(expr.right, env, values);
        break;
      case 'UnaryExpr':
        this.collectValuesRecursive(expr.operand, env, values);
        break;
      case 'MemberExpr':
        this.collectValuesRecursive(expr.object, env, values);
        break;
      case 'OldExpr':
        this.collectValuesRecursive(expr.expression, env, values);
        break;
      default:
        break;
    }
  }
  
  /**
   * Calculate summary statistics.
   */
  private calculateSummary(behaviors: BehaviorResult[]): VerificationReport['summary'] {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const behavior of behaviors) {
      for (const cond of [...behavior.preconditions, ...behavior.postconditions, ...behavior.invariants]) {
        total++;
        switch (cond.result.status) {
          case 'passed':
            passed++;
            break;
          case 'failed':
            failed++;
            break;
          case 'skipped':
            skipped++;
            break;
          case 'error':
            errors++;
            break;
        }
      }
      
      for (const scenario of behavior.scenarios) {
        total++;
        if (scenario.passed) {
          passed++;
        } else if (scenario.error) {
          errors++;
        } else {
          failed++;
        }
      }
    }
    
    return { total, passed, failed, skipped, errors };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Verify an ISL spec against test data.
 */
export async function verify(
  specPath: string,
  testDataPath: string,
  options: Partial<VerificationOptions> = {}
): Promise<VerificationReport> {
  const interpreter = new ISLInterpreter(options);
  return interpreter.verify(specPath, testDataPath);
}

/**
 * Verify an ISL spec against test data with a target module.
 */
export async function verifyWithTarget(
  specPath: string,
  testDataPath: string,
  targetPath: string,
  options: Partial<VerificationOptions> = {}
): Promise<VerificationReport> {
  const interpreter = new ISLInterpreter({ ...options, mode: 'dynamic' });
  return interpreter.verify(specPath, testDataPath, targetPath);
}
