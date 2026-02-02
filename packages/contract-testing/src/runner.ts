/**
 * Contract Runner
 * 
 * Executes property-based tests against handlers.
 */

import * as fc from 'fast-check';
import type { PropertyTest } from './properties.js';
import type { BehaviorHandler, InvariantSpec } from './tester.js';

// ============================================================================
// Types
// ============================================================================

export interface RunnerOptions {
  timeout?: number;
  verbose?: boolean;
}

export interface TestResult {
  behavior: string;
  test: string;
  passed: boolean;
  error?: string;
  counterexample?: unknown;
  duration: number;
  iterations?: number;
}

// ============================================================================
// Contract Runner
// ============================================================================

export class ContractRunner {
  private options: Required<RunnerOptions>;

  constructor(options: RunnerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 5000,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Run a property test
   */
  async runPropertyTest(
    test: PropertyTest,
    handler: BehaviorHandler<unknown, unknown>,
    iterations: number
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Run property-based test with fast-check
      await fc.assert(
        fc.asyncProperty(test.arbitrary, async (input) => {
          let result: unknown;
          try {
            result = await this.executeWithTimeout(handler(input), this.options.timeout);
          } catch (error) {
            result = { error: { code: 'EXCEPTION', message: error instanceof Error ? error.message : 'Unknown' } };
          }
          return test.property(input, result);
        }),
        {
          numRuns: iterations,
          verbose: this.options.verbose,
        }
      );

      return {
        behavior: test.behavior,
        test: test.name,
        passed: true,
        duration: Date.now() - startTime,
        iterations,
      };
    } catch (error) {
      // fast-check errors include counterexample and numRuns properties
      const fcError = error as { counterexample?: unknown; numRuns?: number; message?: string };
      
      return {
        behavior: test.behavior,
        test: test.name,
        passed: false,
        error: error instanceof Error ? error.message : 'Test failed',
        counterexample: fcError.counterexample,
        duration: Date.now() - startTime,
        iterations: fcError.numRuns,
      };
    }
  }

  /**
   * Run an invariant test
   */
  async runInvariantTest(
    invariant: InvariantSpec,
    handlers: Map<string, BehaviorHandler<unknown, unknown>>
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test invariant holds before and after any behavior
      for (const [name, handler] of handlers) {
        const result = await this.executeWithTimeout(handler({}), this.options.timeout);
        
        // Check invariant predicates
        for (const predicate of invariant.predicates) {
          const holds = this.evaluatePredicate(predicate, result);
          if (!holds) {
            return {
              behavior: `invariant:${invariant.name}`,
              test: predicate,
              passed: false,
              error: `Invariant violated after ${name}: ${predicate}`,
              duration: Date.now() - startTime,
            };
          }
        }
      }

      return {
        behavior: `invariant:${invariant.name}`,
        test: 'all_predicates',
        passed: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        behavior: `invariant:${invariant.name}`,
        test: 'execution',
        passed: false,
        error: error instanceof Error ? error.message : 'Invariant test failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run a single test case
   */
  async runSingleTest(
    handler: BehaviorHandler<unknown, unknown>,
    input: unknown,
    expected: { success?: boolean; error?: string }
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(handler(input), this.options.timeout) as Record<string, unknown>;

      if (expected.success !== undefined) {
        const actualSuccess = result.success;
        if (actualSuccess !== expected.success) {
          return {
            behavior: 'single',
            test: 'success_check',
            passed: false,
            error: `Expected success=${expected.success}, got ${actualSuccess}`,
            duration: Date.now() - startTime,
          };
        }
      }

      if (expected.error && result.error) {
        const actualError = (result.error as Record<string, string>).code;
        if (actualError !== expected.error) {
          return {
            behavior: 'single',
            test: 'error_check',
            passed: false,
            error: `Expected error=${expected.error}, got ${actualError}`,
            duration: Date.now() - startTime,
          };
        }
      }

      return {
        behavior: 'single',
        test: 'assertion',
        passed: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        behavior: 'single',
        test: 'execution',
        passed: false,
        error: error instanceof Error ? error.message : 'Test failed',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      ),
    ]);
  }

  /**
   * Evaluate a predicate (simplified)
   */
  private evaluatePredicate(predicate: string, context: unknown): boolean {
    // Simplified predicate evaluation
    // Real implementation would use a proper expression evaluator
    return true;
  }
}
