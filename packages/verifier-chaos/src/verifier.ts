/**
 * Chaos Verifier
 * 
 * Main verification logic for chaos testing implementations.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import { parseScenarioNames, type ParsedChaosScenario } from './scenarios.js';
import { ChaosExecutor, type ScenarioResult, type BehaviorImplementation } from './executor.js';
import type { TimelineReport } from './timeline.js';

export interface VerifyResult {
  success: boolean;
  verdict: 'verified' | 'risky' | 'unsafe';
  score: number;
  passed: ChaosTestResult[];
  failed: ChaosTestResult[];
  skipped: ChaosTestResult[];
  coverage: ChaosCoverageReport;
  timing: ChaosTimingReport;
  timeline: TimelineReport;
}

export interface ChaosTestResult {
  name: string;
  type: 'chaos';
  passed: boolean;
  duration: number;
  error?: ChaosTestError;
  injections: string[];
}

export interface ChaosTestError {
  message: string;
  expected?: unknown;
  actual?: unknown;
  injectionType?: string;
}

export interface ChaosCoverageReport {
  injectionTypes: CoverageMetric;
  scenarios: CoverageMetric;
  behaviors: CoverageMetric;
  overall: number;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface ChaosTimingReport {
  total: number;
  setup: number;
  execution: number;
  teardown: number;
  byScenario: Map<string, number>;
}

export interface VerifyOptions {
  /** Timeout for each scenario (ms) */
  timeoutMs?: number;
  /** Continue running scenarios after failure */
  continueOnFailure?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom implementation adapter */
  implementationAdapter?: ImplementationAdapter;
}

export interface ImplementationAdapter {
  load(implementationPath: string): Promise<BehaviorImplementation>;
}

/**
 * Chaos verifier class
 */
export class ChaosVerifier {
  private options: Required<VerifyOptions>;
  private executor: ChaosExecutor;

  constructor(options: VerifyOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? 30000,
      continueOnFailure: options.continueOnFailure ?? true,
      verbose: options.verbose ?? false,
      implementationAdapter: options.implementationAdapter ?? createDefaultAdapter(),
    };
    this.executor = new ChaosExecutor({
      timeoutMs: this.options.timeoutMs,
      continueOnFailure: this.options.continueOnFailure,
      verbose: this.options.verbose,
    });
  }

  /**
   * Verify an implementation against chaos scenarios
   */
  async verify(
    implementationPath: string,
    domain: DomainDeclaration,
    behaviorName: string,
    scenarioNames: string[] = []
  ): Promise<VerifyResult> {
    const startTime = Date.now();
    const setupStartTime = startTime;

    // Parse scenarios
    const parseResult = parseScenarioNames(domain, behaviorName, scenarioNames);
    if (!parseResult.success) {
      return this.createFailedResult(
        parseResult.errors.map(e => e.message).join(', '),
        startTime
      );
    }

    const scenarios = parseResult.scenarios;
    if (scenarios.length === 0) {
      return this.createFailedResult(
        `No chaos scenarios found for behavior: ${behaviorName}`,
        startTime
      );
    }

    // Load implementation
    let implementation: BehaviorImplementation;
    try {
      implementation = await this.options.implementationAdapter.load(implementationPath);
    } catch (error) {
      return this.createFailedResult(
        `Failed to load implementation: ${error instanceof Error ? error.message : String(error)}`,
        startTime
      );
    }

    const setupEndTime = Date.now();
    const executionStartTime = setupEndTime;

    // Execute scenarios
    const results = await this.executor.executeScenarios(
      scenarios,
      domain,
      implementation
    );

    const executionEndTime = Date.now();

    // Compile results
    return this.compileResults(
      results,
      scenarios,
      domain,
      {
        total: executionEndTime - startTime,
        setup: setupEndTime - setupStartTime,
        execution: executionEndTime - executionStartTime,
        teardown: Date.now() - executionEndTime,
      }
    );
  }

  /**
   * Verify with a pre-loaded implementation
   */
  async verifyWithImplementation(
    implementation: BehaviorImplementation,
    domain: DomainDeclaration,
    behaviorName: string,
    scenarioNames: string[] = []
  ): Promise<VerifyResult> {
    const startTime = Date.now();

    // Parse scenarios
    const parseResult = parseScenarioNames(domain, behaviorName, scenarioNames);
    if (!parseResult.success) {
      return this.createFailedResult(
        parseResult.errors.map(e => e.message).join(', '),
        startTime
      );
    }

    const scenarios = parseResult.scenarios;
    if (scenarios.length === 0) {
      return this.createFailedResult(
        `No chaos scenarios found for behavior: ${behaviorName}`,
        startTime
      );
    }

    const executionStartTime = Date.now();

    // Execute scenarios
    const results = await this.executor.executeScenarios(
      scenarios,
      domain,
      implementation
    );

    const executionEndTime = Date.now();

    return this.compileResults(
      results,
      scenarios,
      domain,
      {
        total: executionEndTime - startTime,
        setup: executionStartTime - startTime,
        execution: executionEndTime - executionStartTime,
        teardown: 0,
      }
    );
  }

  /**
   * Compile scenario results into verify result
   */
  private compileResults(
    results: ScenarioResult[],
    scenarios: ParsedChaosScenario[],
    domain: DomainDeclaration,
    timing: { total: number; setup: number; execution: number; teardown: number }
  ): VerifyResult {
    const passed: ChaosTestResult[] = [];
    const failed: ChaosTestResult[] = [];
    const skipped: ChaosTestResult[] = [];
    const byScenario = new Map<string, number>();

    // Categorize results
    for (const result of results) {
      byScenario.set(result.name, result.duration);
      
      const testResult: ChaosTestResult = {
        name: result.name,
        type: 'chaos',
        passed: result.passed,
        duration: result.duration,
        injections: result.injections.map(i => i.type),
      };

      if (!result.passed) {
        const failedAssertion = result.assertions.find(a => !a.passed);
        testResult.error = {
          message: failedAssertion?.message ?? result.error?.message ?? 'Unknown error',
          expected: failedAssertion?.expected,
          actual: failedAssertion?.actual,
          injectionType: result.injections[0]?.type,
        };
      }

      if (result.passed) {
        passed.push(testResult);
      } else {
        failed.push(testResult);
      }
    }

    // Check for skipped scenarios
    const executedNames = new Set(results.map(r => r.name));
    for (const scenario of scenarios) {
      if (!executedNames.has(scenario.name)) {
        skipped.push({
          name: scenario.name,
          type: 'chaos',
          passed: false,
          duration: 0,
          injections: scenario.injections.map(i => i.type),
        });
      }
    }

    // Calculate coverage
    const coverage = this.calculateCoverage(results, scenarios, domain);

    // Calculate score
    const score = this.calculateScore(passed.length, failed.length, skipped.length);

    // Determine verdict
    const verdict = this.determineVerdict(score, failed.length);

    // Get combined timeline
    const timeline = results[results.length - 1]?.timeline ?? {
      events: [],
      startTime: Date.now(),
      endTime: Date.now(),
      totalDuration: timing.total,
      injectionCount: 0,
      errorCount: failed.length,
      recoveryCount: 0,
    };

    return {
      success: failed.length === 0,
      verdict,
      score,
      passed,
      failed,
      skipped,
      coverage,
      timing: {
        ...timing,
        byScenario,
      },
      timeline,
    };
  }

  /**
   * Calculate coverage metrics
   */
  private calculateCoverage(
    results: ScenarioResult[],
    scenarios: ParsedChaosScenario[],
    domain: DomainDeclaration
  ): ChaosCoverageReport {
    // Injection type coverage
    const allInjectionTypes = new Set([
      'database_failure',
      'network_latency',
      'service_unavailable',
      'concurrent_requests',
    ]);
    const coveredInjectionTypes = new Set<string>();
    for (const result of results) {
      for (const injection of result.injections) {
        coveredInjectionTypes.add(injection.type);
      }
    }

    // Scenario coverage
    const totalScenarios = scenarios.length;
    const coveredScenarios = results.length;

    // Behavior coverage
    const totalBehaviors = domain.behaviors.length;
    const coveredBehaviors = new Set(scenarios.map(s => s.behaviorName)).size;

    const injectionTypes: CoverageMetric = {
      total: allInjectionTypes.size,
      covered: coveredInjectionTypes.size,
      percentage: (coveredInjectionTypes.size / allInjectionTypes.size) * 100,
    };

    const scenariosCoverage: CoverageMetric = {
      total: totalScenarios,
      covered: coveredScenarios,
      percentage: totalScenarios > 0 ? (coveredScenarios / totalScenarios) * 100 : 0,
    };

    const behaviors: CoverageMetric = {
      total: totalBehaviors,
      covered: coveredBehaviors,
      percentage: totalBehaviors > 0 ? (coveredBehaviors / totalBehaviors) * 100 : 0,
    };

    const overall = (
      injectionTypes.percentage * 0.3 +
      scenariosCoverage.percentage * 0.5 +
      behaviors.percentage * 0.2
    );

    return {
      injectionTypes,
      scenarios: scenariosCoverage,
      behaviors,
      overall,
    };
  }

  /**
   * Calculate verification score (0-100)
   */
  private calculateScore(passed: number, failed: number, skipped: number): number {
    const total = passed + failed + skipped;
    if (total === 0) return 0;

    // Weight: passed = 1.0, failed = 0, skipped = 0.5
    const weightedScore = (passed * 1.0 + skipped * 0.5) / total;
    return Math.round(weightedScore * 100);
  }

  /**
   * Determine verification verdict
   */
  private determineVerdict(score: number, failedCount: number): 'verified' | 'risky' | 'unsafe' {
    if (failedCount === 0 && score >= 80) return 'verified';
    if (failedCount > 0 && score < 50) return 'unsafe';
    return 'risky';
  }

  /**
   * Create a failed result for early errors
   */
  private createFailedResult(message: string, startTime: number): VerifyResult {
    return {
      success: false,
      verdict: 'unsafe',
      score: 0,
      passed: [],
      failed: [{
        name: 'setup',
        type: 'chaos',
        passed: false,
        duration: Date.now() - startTime,
        error: { message },
        injections: [],
      }],
      skipped: [],
      coverage: {
        injectionTypes: { total: 0, covered: 0, percentage: 0 },
        scenarios: { total: 0, covered: 0, percentage: 0 },
        behaviors: { total: 0, covered: 0, percentage: 0 },
        overall: 0,
      },
      timing: {
        total: Date.now() - startTime,
        setup: Date.now() - startTime,
        execution: 0,
        teardown: 0,
        byScenario: new Map(),
      },
      timeline: {
        events: [],
        startTime,
        endTime: Date.now(),
        totalDuration: Date.now() - startTime,
        injectionCount: 0,
        errorCount: 1,
        recoveryCount: 0,
      },
    };
  }
}

/**
 * Create default implementation adapter
 */
function createDefaultAdapter(): ImplementationAdapter {
  return {
    async load(implementationPath: string): Promise<BehaviorImplementation> {
      // In a real implementation, this would dynamically import the module
      // For now, return a mock that throws to indicate it needs to be provided
      throw new Error(
        `Cannot load implementation from path: ${implementationPath}. ` +
        `Please provide a custom implementationAdapter or use verifyWithImplementation().`
      );
    },
  };
}

/**
 * Verify an implementation against chaos scenarios
 */
export async function verify(
  implementation: string,
  domain: DomainDeclaration,
  behaviorName: string,
  scenarios: string[] = [],
  options?: VerifyOptions
): Promise<VerifyResult> {
  const verifier = new ChaosVerifier(options);
  return verifier.verify(implementation, domain, behaviorName, scenarios);
}

/**
 * Create a chaos verifier instance
 */
export function createVerifier(options?: VerifyOptions): ChaosVerifier {
  return new ChaosVerifier(options);
}
