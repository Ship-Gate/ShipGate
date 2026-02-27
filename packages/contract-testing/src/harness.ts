/**
 * Contract Test Harness
 * 
 * Binds behaviors to endpoint/functions and feeds scenarios as test cases.
 */

import type { ISLScenario } from './scenario-parser.js';
import type { BehaviorHandler } from './tester.js';

// ============================================================================
// Types
// ============================================================================

export interface TestCase {
  name: string;
  behaviorName: string;
  given: Record<string, unknown>;
  when: {
    behavior: string;
    input: Record<string, unknown>;
  };
  then: {
    assertions: Assertion[];
  };
}

export interface Assertion {
  type: 'success' | 'failure' | 'error' | 'property';
  expected?: unknown;
  property?: string;
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value?: unknown;
}

export interface TestResult {
  name: string;
  behaviorName: string;
  passed: boolean;
  error?: string;
  duration: number;
  actualResult?: unknown;
}

export interface HarnessConfig {
  timeout?: number;
  verbose?: boolean;
}

// ============================================================================
// Contract Test Harness
// ============================================================================

export class ContractTestHarness {
  private handlers: Map<string, BehaviorHandler<unknown, unknown>> = new Map();
  private config: Required<HarnessConfig>;

  constructor(config: HarnessConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 5000,
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Bind a behavior to a handler function
   */
  bindBehavior<TInput, TOutput>(
    behaviorName: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): this {
    this.handlers.set(behaviorName, handler as BehaviorHandler<unknown, unknown>);
    return this;
  }

  /**
   * Convert ISL scenario to test case
   */
  scenarioToTestCase(scenario: ISLScenario): TestCase {
    // Extract given block variables
    const given: Record<string, unknown> = {};
    for (const stmt of scenario.given) {
      if (stmt.kind === 'AssignmentStmt' && stmt.target) {
        given[stmt.target] = stmt.value;
      }
    }

    // Extract when block - find behavior call
    let behaviorName = scenario.behaviorName;
    const whenInput: Record<string, unknown> = {};
    
    for (const stmt of scenario.when) {
      if (stmt.kind === 'AssignmentStmt' && stmt.target === 'result') {
        // Extract behavior call from value
        const call = stmt.value as any;
        if (call?.callee) {
          behaviorName = call.callee;
          // Extract arguments
          if (call.arguments) {
            // Parse arguments like "email: email" or "amount: 100.00"
            for (const arg of call.arguments) {
              if (typeof arg === 'object' && arg !== null) {
                // Handle named arguments if structured
                Object.assign(whenInput, arg);
              }
            }
          }
        }
      } else if (stmt.call) {
        behaviorName = stmt.call.callee;
        // Extract input from call arguments
        if (stmt.call.arguments) {
          for (const arg of stmt.call.arguments) {
            if (typeof arg === 'object' && arg !== null) {
              Object.assign(whenInput, arg);
            }
          }
        }
      }
    }

    // Resolve variables from given block
    const resolvedInput: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(whenInput)) {
      if (typeof value === 'string' && given[value] !== undefined) {
        resolvedInput[key] = given[value];
      } else {
        resolvedInput[key] = value;
      }
    }

    // Extract then block assertions
    const assertions: Assertion[] = [];
    for (const expr of scenario.then) {
      const assertion = this.parseAssertion(expr.expression, given);
      if (assertion) {
        assertions.push(assertion);
      }
    }

    return {
      name: scenario.name,
      behaviorName,
      given,
      when: {
        behavior: behaviorName,
        input: resolvedInput,
      },
      then: {
        assertions,
      },
    };
  }

  /**
   * Parse assertion from expression string
   */
  private parseAssertion(expression: string, given: Record<string, unknown>): Assertion | null {
    expression = expression.trim();

    // Check for "result is success"
    if (expression === 'result is success' || expression.match(/^result\s+is\s+success$/i)) {
      return { type: 'success' };
    }

    // Check for "result is failure"
    if (expression === 'result is failure' || expression.match(/^result\s+is\s+failure$/i)) {
      return { type: 'failure' };
    }

    // Check for "result.error == ERROR_NAME"
    const errorMatch = expression.match(/^result\.error\s*==\s*(\w+)$/);
    if (errorMatch) {
      return {
        type: 'error',
        expected: errorMatch[1],
      };
    }

    // Check for property comparisons: "result.field == value"
    const propertyMatch = expression.match(/^result\.(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (propertyMatch) {
      const [, property, operator, valueStr] = propertyMatch;
      let value: unknown = valueStr;
      
      // Try to resolve value from given block
      if (valueStr in given) {
        value = given[valueStr];
      } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
        value = valueStr.slice(1, -1);
      } else if (!isNaN(Number(valueStr))) {
        value = Number(valueStr);
      } else if (valueStr === 'true' || valueStr === 'false') {
        value = valueStr === 'true';
      }

      return {
        type: 'property',
        property,
        operator: operator as Assertion['operator'],
        value,
      };
    }

    // Check for entity property comparisons: "Entity.field == value"
    const entityMatch = expression.match(/^(\w+)\.(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (entityMatch) {
      const [, entity, property, operator, valueStr] = entityMatch;
      let value: unknown = valueStr;
      
      if (valueStr in given) {
        value = given[valueStr];
      } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
        value = valueStr.slice(1, -1);
      } else if (!isNaN(Number(valueStr))) {
        value = Number(valueStr);
      }

      return {
        type: 'property',
        property: `${entity}.${property}`,
        operator: operator as Assertion['operator'],
        value,
      };
    }

    return null;
  }

  /**
   * Run a test case
   */
  async runTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const handler = this.handlers.get(testCase.when.behavior);

    if (!handler) {
      return {
        name: testCase.name,
        behaviorName: testCase.behaviorName,
        passed: false,
        error: `No handler registered for behavior '${testCase.when.behavior}'`,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Execute the behavior
      const result = await Promise.race([
        handler(testCase.when.input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), this.config.timeout)
        ),
      ]);

      // Evaluate assertions
      const assertionResults = testCase.then.assertions.map((assertion) =>
        this.evaluateAssertion(assertion, result, testCase.given)
      );

      const allPassed = assertionResults.every((r) => r.passed);

      if (!allPassed) {
        const failedAssertions = assertionResults
          .filter((r) => !r.passed)
          .map((r) => r.error)
          .join('; ');
        
        return {
          name: testCase.name,
          behaviorName: testCase.behaviorName,
          passed: false,
          error: `Assertions failed: ${failedAssertions}`,
          duration: Date.now() - startTime,
          actualResult: result,
        };
      }

      return {
        name: testCase.name,
        behaviorName: testCase.behaviorName,
        passed: true,
        duration: Date.now() - startTime,
        actualResult: result,
      };
    } catch (error) {
      return {
        name: testCase.name,
        behaviorName: testCase.behaviorName,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluate a single assertion
   */
  private evaluateAssertion(
    assertion: Assertion,
    result: unknown,
    given: Record<string, unknown>
  ): { passed: boolean; error?: string } {
    const resultObj = result as Record<string, unknown>;

    if (assertion.type === 'success') {
      const isSuccess = resultObj && 'success' in resultObj && resultObj.success !== false;
      if (!isSuccess && 'error' in resultObj) {
        return {
          passed: false,
          error: `Expected success but got error: ${JSON.stringify(resultObj.error)}`,
        };
      }
      return { passed: isSuccess };
    }

    if (assertion.type === 'failure') {
      const isFailure = resultObj && ('error' in resultObj || resultObj.success === false);
      return { passed: isFailure };
    }

    if (assertion.type === 'error') {
      const errorCode = resultObj?.error && typeof resultObj.error === 'object' && 'code' in resultObj.error
        ? resultObj.error.code
        : resultObj?.error;
      
      if (errorCode !== assertion.expected) {
        return {
          passed: false,
          error: `Expected error '${assertion.expected}' but got '${errorCode}'`,
        };
      }
      return { passed: true };
    }

    if (assertion.type === 'property' && assertion.property) {
      const propertyPath = assertion.property.split('.');
      let value: unknown = resultObj;

      for (const prop of propertyPath) {
        if (value && typeof value === 'object' && prop in value) {
          value = (value as Record<string, unknown>)[prop];
        } else {
          return {
            passed: false,
            error: `Property '${assertion.property}' not found in result`,
          };
        }
      }

      const comparison = this.compareValues(value, assertion.operator || '==', assertion.value);
      if (!comparison.passed) {
        return {
          passed: false,
          error: `Property '${assertion.property}': expected ${assertion.operator} ${JSON.stringify(assertion.value)}, got ${JSON.stringify(value)}`,
        };
      }
      return { passed: true };
    }

    return { passed: true };
  }

  /**
   * Compare two values with operator
   */
  private compareValues(
    actual: unknown,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    expected: unknown
  ): { passed: boolean } {
    switch (operator) {
      case '==':
        return { passed: actual === expected || JSON.stringify(actual) === JSON.stringify(expected) };
      case '!=':
        return { passed: actual !== expected && JSON.stringify(actual) !== JSON.stringify(expected) };
      case '>':
        return { passed: Number(actual) > Number(expected) };
      case '<':
        return { passed: Number(actual) < Number(expected) };
      case '>=':
        return { passed: Number(actual) >= Number(expected) };
      case '<=':
        return { passed: Number(actual) <= Number(expected) };
      default:
        return { passed: false };
    }
  }

  /**
   * Run all test cases for scenarios
   */
  async runScenarios(scenarios: ISLScenario[]): Promise<TestResult[]> {
    const testCases = scenarios.map((s) => this.scenarioToTestCase(s));
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase);
      results.push(result);
    }

    return results;
  }
}
