/**
 * Contract Tester
 * 
 * Main entry point for contract testing.
 */

import { PropertyGenerator, type PropertyTest } from './properties.js';
import { ContractRunner, type TestResult } from './runner.js';
import { CoverageAnalyzer, type CoverageReport } from './coverage.js';

// ============================================================================
// Types
// ============================================================================

export interface TesterConfig {
  /** Number of test iterations for property-based testing */
  iterations?: number;
  /** Timeout per test in ms */
  timeout?: number;
  /** Enable verbose output */
  verbose?: boolean;
  /** Seed for reproducible tests */
  seed?: number;
  /** Enable coverage tracking */
  coverage?: boolean;
}

export interface DomainSpec {
  name: string;
  behaviors: BehaviorSpec[];
  entities: EntitySpec[];
  types: TypeSpec[];
  invariants: InvariantSpec[];
}

export interface BehaviorSpec {
  name: string;
  input?: { fields: FieldSpec[] };
  output?: { success: string; errors: ErrorSpec[] };
  preconditions: string[];
  postconditions: PostconditionSpec[];
}

export interface EntitySpec {
  name: string;
  fields: FieldSpec[];
}

export interface TypeSpec {
  name: string;
  baseType: string;
  constraints: { name: string; value: unknown }[];
}

export interface FieldSpec {
  name: string;
  type: string;
  optional: boolean;
  constraints: { name: string; value: unknown }[];
}

export interface ErrorSpec {
  name: string;
  retriable: boolean;
}

export interface PostconditionSpec {
  guard: string;
  predicates: string[];
}

export interface InvariantSpec {
  name: string;
  predicates: string[];
}

export interface BehaviorHandler<TInput, TOutput> {
  (input: TInput): Promise<TOutput>;
}

export interface TestSuiteResult {
  domain: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageReport;
  results: TestResult[];
}

// ============================================================================
// Contract Tester
// ============================================================================

export class ContractTester {
  private config: Required<TesterConfig>;
  private domain: DomainSpec | null = null;
  private handlers: Map<string, BehaviorHandler<unknown, unknown>> = new Map();
  private propertyGenerator: PropertyGenerator;
  private runner: ContractRunner;
  private coverageAnalyzer: CoverageAnalyzer;

  constructor(config: TesterConfig = {}) {
    this.config = {
      iterations: config.iterations ?? 100,
      timeout: config.timeout ?? 5000,
      verbose: config.verbose ?? false,
      seed: config.seed ?? Date.now(),
      coverage: config.coverage ?? true,
    };

    this.propertyGenerator = new PropertyGenerator(this.config.seed);
    this.runner = new ContractRunner({
      timeout: this.config.timeout,
      verbose: this.config.verbose,
    });
    this.coverageAnalyzer = new CoverageAnalyzer();
  }

  /**
   * Load ISL domain specification
   */
  loadSpec(spec: DomainSpec): this {
    this.domain = spec;
    if (this.config.coverage) {
      this.coverageAnalyzer.registerSpec(spec);
    }
    return this;
  }

  /**
   * Register a behavior handler
   */
  registerHandler<TInput, TOutput>(
    behavior: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): this {
    this.handlers.set(behavior, handler as BehaviorHandler<unknown, unknown>);
    return this;
  }

  /**
   * Run all contract tests
   */
  async runAll(): Promise<TestSuiteResult> {
    if (!this.domain) {
      throw new Error('No domain spec loaded. Call loadSpec() first.');
    }

    const startTime = Date.now();
    const results: TestResult[] = [];

    for (const behavior of this.domain.behaviors) {
      const handler = this.handlers.get(behavior.name);
      if (!handler) {
        results.push({
          behavior: behavior.name,
          test: 'handler_exists',
          passed: false,
          error: `No handler registered for behavior '${behavior.name}'`,
          duration: 0,
        });
        continue;
      }

      // Run property-based tests
      const propertyTests = this.propertyGenerator.generateTests(behavior, this.domain);
      
      for (const test of propertyTests) {
        const result = await this.runner.runPropertyTest(test, handler, this.config.iterations);
        results.push(result);

        if (this.config.coverage && result.passed) {
          this.coverageAnalyzer.recordExecution(behavior.name, test.name);
        }
      }
    }

    // Run invariant tests
    for (const invariant of this.domain.invariants) {
      const result = await this.runner.runInvariantTest(invariant, this.handlers);
      results.push(result);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      domain: this.domain.name,
      totalTests: results.length,
      passed,
      failed,
      skipped: 0,
      duration,
      coverage: this.config.coverage ? this.coverageAnalyzer.getReport() : undefined,
      results,
    };
  }

  /**
   * Run tests for a specific behavior
   */
  async runBehavior(behaviorName: string): Promise<TestResult[]> {
    if (!this.domain) {
      throw new Error('No domain spec loaded. Call loadSpec() first.');
    }

    const behavior = this.domain.behaviors.find(b => b.name === behaviorName);
    if (!behavior) {
      throw new Error(`Behavior '${behaviorName}' not found in spec`);
    }

    const handler = this.handlers.get(behaviorName);
    if (!handler) {
      throw new Error(`No handler registered for behavior '${behaviorName}'`);
    }

    const propertyTests = this.propertyGenerator.generateTests(behavior, this.domain);
    const results: TestResult[] = [];

    for (const test of propertyTests) {
      const result = await this.runner.runPropertyTest(test, handler, this.config.iterations);
      results.push(result);
    }

    return results;
  }

  /**
   * Print test results
   */
  printResults(suite: TestSuiteResult): void {
    console.log('\n' + '='.repeat(60));
    console.log(`Contract Test Results: ${suite.domain}`);
    console.log('='.repeat(60));
    console.log(`Total: ${suite.totalTests} | Passed: ${suite.passed} | Failed: ${suite.failed}`);
    console.log(`Duration: ${suite.duration}ms`);
    console.log('');

    for (const result of suite.results) {
      const status = result.passed ? '✓' : '✗';
      const color = result.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status}\x1b[0m ${result.behavior}.${result.test} (${result.duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`  Error: ${result.error}`);
        if (result.counterexample) {
          console.log(`  Counterexample: ${JSON.stringify(result.counterexample)}`);
        }
      }
    }

    if (suite.coverage) {
      console.log('\n' + '-'.repeat(60));
      console.log('Coverage Summary:');
      console.log(`  Preconditions: ${suite.coverage.preconditions.toFixed(1)}%`);
      console.log(`  Postconditions: ${suite.coverage.postconditions.toFixed(1)}%`);
      console.log(`  Error paths: ${suite.coverage.errorPaths.toFixed(1)}%`);
    }

    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Create a contract tester
 */
export function createContractTester(config?: TesterConfig): ContractTester {
  return new ContractTester(config);
}
