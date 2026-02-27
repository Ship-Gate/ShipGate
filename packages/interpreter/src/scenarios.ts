// ============================================================================
// ISL Interpreter - Scenario Runner
// @isl-lang/interpreter/scenarios
// ============================================================================

import type { Value, Environment } from '@isl-lang/runtime-interpreter';
import type {
  Scenario,
  Statement,
  Expression as ASTExpression,
  Identifier,
  MapEntry,
} from '@isl-lang/parser';
import type {
  ScenarioResult,
  StepResult,
  CheckResult,
  Bindings,
  ScenarioTestData,
  VerificationOptions,
} from './types';
import { toValue, fromValue } from './bindings';
import { cloneValues } from './executor';

// ============================================================================
// SCENARIO RUNNER
// ============================================================================

export interface ScenarioContext {
  /** Current variable bindings */
  bindings: Bindings;
  
  /** Evaluation function for expressions */
  evaluate: (expr: ASTExpression, env: Environment) => Promise<Value>;
  
  /** Execution function for statements */
  execute: (stmt: Statement, env: Environment) => Promise<void>;
  
  /** Create environment from bindings */
  createEnvironment: (bindings: Bindings) => Environment;
  
  /** Verification options */
  options: VerificationOptions;
}

/**
 * Run all scenarios for a behavior.
 */
export async function runScenarios(
  scenarios: Scenario[],
  testData: ScenarioTestData[] | undefined,
  ctx: ScenarioContext
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  
  for (const scenario of scenarios) {
    const scenarioData = testData?.find(
      (d) => d.name === (typeof scenario.name === 'string' ? scenario.name : scenario.name.value)
    );
    
    const result = await runScenario(scenario, scenarioData, ctx);
    results.push(result);
    
    // Stop on first failure if failFast is enabled
    if (ctx.options.failFast && !result.passed) {
      break;
    }
  }
  
  return results;
}

/**
 * Run a single scenario.
 */
export async function runScenario(
  scenario: Scenario,
  testData: ScenarioTestData | undefined,
  ctx: ScenarioContext
): Promise<ScenarioResult> {
  const startTime = performance.now();
  const scenarioName = typeof scenario.name === 'string' ? scenario.name : scenario.name.value;
  
  try {
    // Initialize bindings with test data if provided
    const bindings = initializeScenarioBindings(ctx.bindings, testData);
    const scenarioCtx = { ...ctx, bindings };
    
    // Execute given steps
    const givenResults = await executeSteps(scenario.given, 'given', scenarioCtx);
    const givenPassed = givenResults.every((r) => r.result.status === 'passed');
    
    if (!givenPassed) {
      return {
        name: scenarioName,
        given: givenResults,
        when: [],
        then: [],
        passed: false,
        duration: performance.now() - startTime,
      };
    }
    
    // Execute when steps
    const whenResults = await executeSteps(scenario.when, 'when', scenarioCtx);
    const whenPassed = whenResults.every((r) => r.result.status === 'passed');
    
    if (!whenPassed) {
      return {
        name: scenarioName,
        given: givenResults,
        when: whenResults,
        then: [],
        passed: false,
        duration: performance.now() - startTime,
      };
    }
    
    // Evaluate then assertions
    const thenResults = await evaluateAssertions(scenario.then, testData?.expected, scenarioCtx);
    const thenPassed = thenResults.every((r) => r.status === 'passed');
    
    return {
      name: scenarioName,
      given: givenResults,
      when: whenResults,
      then: thenResults,
      passed: thenPassed,
      duration: performance.now() - startTime,
    };
  } catch (error) {
    return {
      name: scenarioName,
      given: [],
      when: [],
      then: [],
      passed: false,
      duration: performance.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Initialize bindings for a scenario with test data.
 */
function initializeScenarioBindings(
  baseBindings: Bindings,
  testData?: ScenarioTestData
): Bindings {
  const bindings: Bindings = {
    pre: cloneValues(baseBindings.pre),
    post: cloneValues(baseBindings.post),
    old: cloneValues(baseBindings.old),
    result: baseBindings.result,
  };
  
  // Apply given data from test data
  if (testData?.given) {
    for (const [key, value] of Object.entries(testData.given)) {
      bindings.pre.set(key, toValue(value));
    }
  }
  
  // Apply when data from test data
  if (testData?.when) {
    for (const [key, value] of Object.entries(testData.when)) {
      bindings.pre.set(key, toValue(value));
    }
  }
  
  return bindings;
}

/**
 * Execute scenario steps (given/when).
 */
async function executeSteps(
  steps: Statement[],
  phase: 'given' | 'when',
  ctx: ScenarioContext
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const env = ctx.createEnvironment(ctx.bindings);
  
  for (const step of steps) {
    const startTime = performance.now();
    const description = describeStep(step);
    
    try {
      await ctx.execute(step, env);
      
      results.push({
        description,
        result: { status: 'passed', message: `${phase}: ${description}` },
        duration: performance.now() - startTime,
      });
    } catch (error) {
      results.push({
        description,
        result: {
          status: 'error',
          message: `${phase}: ${description}`,
          error: error instanceof Error ? error : new Error(String(error)),
        },
        duration: performance.now() - startTime,
      });
      
      // Stop on first error in a phase
      break;
    }
  }
  
  return results;
}

/**
 * Evaluate then assertions.
 */
async function evaluateAssertions(
  assertions: ASTExpression[],
  expected: ScenarioTestData['expected'],
  ctx: ScenarioContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const env = ctx.createEnvironment(ctx.bindings);
  
  for (const assertion of assertions) {
    const exprStr = stringifyExpression(assertion);
    
    try {
      const result = await ctx.evaluate(assertion, env);
      
      if (result.tag === 'boolean') {
        if (result.value) {
          results.push({
            status: 'passed',
            message: exprStr,
            values: collectExpressionValues(assertion, env),
          });
        } else {
          results.push({
            status: 'failed',
            message: exprStr,
            expected: true,
            actual: false,
            values: collectExpressionValues(assertion, env),
          });
        }
      } else {
        results.push({
          status: 'failed',
          message: `Expected boolean result from assertion: ${exprStr}`,
          expected: 'boolean',
          actual: result.tag,
        });
      }
    } catch (error) {
      results.push({
        status: 'error',
        message: exprStr,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  
  // Check expected results from test data
  if (expected) {
    if (expected.success !== undefined) {
      const hasResult = ctx.bindings.result !== undefined;
      const isSuccess = hasResult && ctx.bindings.result?.tag !== 'result'
        ? true
        : (ctx.bindings.result as { tag: 'result'; success: boolean })?.success;
      
      if (expected.success === isSuccess) {
        results.push({
          status: 'passed',
          message: `Expected success=${expected.success}`,
        });
      } else {
        results.push({
          status: 'failed',
          message: `Expected success=${expected.success}`,
          expected: expected.success,
          actual: isSuccess,
        });
      }
    }
    
    if (expected.result !== undefined && ctx.bindings.result) {
      const actualResult = fromValue(ctx.bindings.result);
      if (deepEqual(expected.result, actualResult)) {
        results.push({
          status: 'passed',
          message: 'Result matches expected',
        });
      } else {
        results.push({
          status: 'failed',
          message: 'Result does not match expected',
          expected: expected.result,
          actual: actualResult,
        });
      }
    }
    
    if (expected.error && ctx.bindings.result?.tag === 'result' && !ctx.bindings.result.success) {
      const error = ctx.bindings.result.error ? fromValue(ctx.bindings.result.error) : null;
      const errorObj = error as { code?: string; message?: string } | null;
      
      if (expected.error.code && errorObj?.code !== expected.error.code) {
        results.push({
          status: 'failed',
          message: `Expected error.code == "${expected.error.code}"`,
          expected: expected.error.code,
          actual: errorObj?.code,
        });
      } else if (expected.error.code) {
        results.push({
          status: 'passed',
          message: `error.code == "${expected.error.code}"`,
        });
      }
      
      if (expected.error.message && errorObj?.message !== expected.error.message) {
        results.push({
          status: 'failed',
          message: `Expected error.message == "${expected.error.message}"`,
          expected: expected.error.message,
          actual: errorObj?.message,
        });
      } else if (expected.error.message) {
        results.push({
          status: 'passed',
          message: `error.message == "${expected.error.message}"`,
        });
      }
    }
  }
  
  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a description for a step.
 */
function describeStep(step: Statement): string {
  switch (step.kind) {
    case 'AssignmentStmt':
      return `${step.target.name} = ${stringifyExpression(step.value)}`;
    case 'CallStmt':
      return step.target
        ? `${step.target.name} = ${stringifyExpression(step.call)}`
        : stringifyExpression(step.call);
    case 'LoopStmt':
      return `repeat ${stringifyExpression(step.count)} times`;
    default:
      return 'unknown step';
  }
}

/**
 * Stringify an expression for display.
 */
function stringifyExpression(expr: ASTExpression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map((p: Identifier) => p.name).join('.');
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'BinaryExpr':
      return `${stringifyExpression(expr.left)} ${expr.operator} ${stringifyExpression(expr.right)}`;
    case 'UnaryExpr':
      return `${expr.operator}${stringifyExpression(expr.operand)}`;
    case 'CallExpr':
      return `${stringifyExpression(expr.callee)}(${expr.arguments.map(stringifyExpression).join(', ')})`;
    case 'MemberExpr':
      return `${stringifyExpression(expr.object)}.${expr.property.name}`;
    case 'IndexExpr':
      return `${stringifyExpression(expr.object)}[${stringifyExpression(expr.index)}]`;
    case 'OldExpr':
      return `old(${stringifyExpression(expr.expression)})`;
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'ConditionalExpr':
      return `${stringifyExpression(expr.condition)} ? ${stringifyExpression(expr.thenBranch)} : ${stringifyExpression(expr.elseBranch)}`;
    case 'QuantifierExpr':
      return `${expr.quantifier} ${expr.variable.name} in ${stringifyExpression(expr.collection)}: ${stringifyExpression(expr.predicate)}`;
    case 'LambdaExpr':
      return `(${expr.params.map((p: Identifier) => p.name).join(', ')}) => ${stringifyExpression(expr.body)}`;
    case 'ListExpr':
      return `[${expr.elements.map(stringifyExpression).join(', ')}]`;
    case 'MapExpr':
      return `{${expr.entries.map((e: MapEntry) => `${stringifyExpression(e.key)}: ${stringifyExpression(e.value)}`).join(', ')}}`;
    default:
      return '<expression>';
  }
}

/**
 * Collect values referenced in an expression for debugging.
 */
function collectExpressionValues(
  expr: ASTExpression,
  env: Environment
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  collectValuesRecursive(expr, env, values);
  return values;
}

function collectValuesRecursive(
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
      collectValuesRecursive(expr.left, env, values);
      collectValuesRecursive(expr.right, env, values);
      break;
    case 'UnaryExpr':
      collectValuesRecursive(expr.operand, env, values);
      break;
    case 'CallExpr':
      collectValuesRecursive(expr.callee, env, values);
      for (const arg of expr.arguments) {
        collectValuesRecursive(arg, env, values);
      }
      break;
    case 'MemberExpr':
      collectValuesRecursive(expr.object, env, values);
      break;
    case 'IndexExpr':
      collectValuesRecursive(expr.object, env, values);
      collectValuesRecursive(expr.index, env, values);
      break;
    case 'ConditionalExpr':
      collectValuesRecursive(expr.condition, env, values);
      collectValuesRecursive(expr.thenBranch, env, values);
      collectValuesRecursive(expr.elseBranch, env, values);
      break;
    case 'OldExpr':
      collectValuesRecursive(expr.expression, env, values);
      break;
    default:
      break;
  }
}

/**
 * Deep equality check for expected vs actual values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }
  
  return false;
}
