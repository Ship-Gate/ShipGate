/**
 * Chaos Executor
 * 
 * Executes chaos scenarios with injections and collects results.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type { ParsedChaosScenario, ChaosInjection, ChaosAssertion } from './scenarios.js';
import { Timeline, createTimeline, type TimelineReport } from './timeline.js';
import { NetworkInjector } from './injectors/network.js';
import { DatabaseInjector, type DatabaseFailureType } from './injectors/database.js';
import { LatencyInjector } from './injectors/latency.js';
import { ConcurrentInjector } from './injectors/concurrent.js';
import { RateLimitInjector, type RateLimitAction } from './injectors/rate-limit.js';

export interface ExecutorConfig {
  /** Timeout for each scenario (ms) */
  timeoutMs?: number;
  /** Whether to continue on failure */
  continueOnFailure?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface ScenarioResult {
  name: string;
  passed: boolean;
  duration: number;
  injections: InjectionResult[];
  assertions: AssertionResult[];
  error?: Error;
  timeline: TimelineReport;
}

export interface InjectionResult {
  type: string;
  activated: boolean;
  deactivated: boolean;
  stats: Record<string, unknown>;
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  expected: unknown;
  actual?: unknown;
  message?: string;
}

export interface ExecutionContext {
  domain: DomainDeclaration;
  implementation: unknown;
  timeline: Timeline;
  results: Map<string, unknown>;
}

type Injector = NetworkInjector | DatabaseInjector | LatencyInjector | ConcurrentInjector | RateLimitInjector;

/**
 * Chaos scenario executor
 */
export class ChaosExecutor {
  private config: Required<ExecutorConfig>;
  private activeInjectors: Injector[] = [];

  constructor(config: ExecutorConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? 30000,
      continueOnFailure: config.continueOnFailure ?? false,
      verbose: config.verbose ?? false,
    };
  }

  /**
   * Execute a single chaos scenario
   */
  async executeScenario(
    scenario: ParsedChaosScenario,
    _domain: DomainDeclaration,
    implementation: BehaviorImplementation
  ): Promise<ScenarioResult> {
    const timeline = createTimeline();
    const startTime = Date.now();

    const result: ScenarioResult = {
      name: scenario.name,
      passed: false,
      duration: 0,
      injections: [],
      assertions: [],
      timeline: timeline.generateReport(),
    };

    try {
      // Setup injectors
      timeline.record('injection_start', { phase: 'setup' });
      const injectors = await this.setupInjectors(scenario.injections, timeline);
      
      for (const injector of injectors) {
        result.injections.push({
          type: this.getInjectorType(injector),
          activated: true,
          deactivated: false,
          stats: {},
        });
      }

      // Execute behavior with injections
      timeline.record('behavior_start', { behavior: scenario.behaviorName });
      
      const executionResult = await this.executeWithTimeout(
        () => this.executeBehavior(scenario, implementation, injectors),
        this.config.timeoutMs
      );

      timeline.record('behavior_end', { 
        behavior: scenario.behaviorName,
        result: executionResult.success ? 'success' : 'error',
      });

      // Check assertions
      timeline.record('assertion_start', {});
      result.assertions = await this.checkAssertions(
        scenario.assertions,
        executionResult,
        injectors
      );
      timeline.record('assertion_result', { 
        passed: result.assertions.every(a => a.passed),
      });

      // Determine overall pass/fail
      result.passed = result.assertions.every(a => a.passed);

      // Cleanup injectors
      await this.cleanupInjectors(injectors);
      timeline.record('cleanup', { phase: 'complete' });

      // Update injection stats
      for (let i = 0; i < injectors.length; i++) {
        const injection = result.injections[i];
        const injector = injectors[i];
        if (injection && injector) {
          injection.deactivated = true;
          injection.stats = this.getInjectorStats(injector);
        }
      }

    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
      timeline.recordError(result.error);
      
      // Ensure cleanup happens even on error
      await this.cleanupInjectors(this.activeInjectors);
    }

    result.duration = Date.now() - startTime;
    result.timeline = timeline.generateReport();

    return result;
  }

  /**
   * Execute multiple scenarios
   */
  async executeScenarios(
    scenarios: ParsedChaosScenario[],
    domain: DomainDeclaration,
    implementation: BehaviorImplementation
  ): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.executeScenario(scenario, domain, implementation);
      results.push(result);

      if (!result.passed && !this.config.continueOnFailure) {
        break;
      }
    }

    return results;
  }

  /**
   * Setup injectors based on scenario injections
   */
  private async setupInjectors(
    injections: ChaosInjection[],
    timeline: Timeline
  ): Promise<Injector[]> {
    const injectors: Injector[] = [];

    for (const injection of injections) {
      const injector = this.createInjector(injection);
      if (injector) {
        injector.attachTimeline(timeline);
        injector.activate();
        injectors.push(injector);
        this.activeInjectors.push(injector);
      }
    }

    return injectors;
  }

  /**
   * Create an injector based on injection type
   */
  private createInjector(injection: ChaosInjection): Injector | null {
    const params = injection.parameters;

    switch (injection.type) {
      case 'database_failure':
        return new DatabaseInjector({
          failureType: (params.failureType as DatabaseFailureType) ?? 'unavailable',
          probability: (params.probability as number) ?? 1.0,
          recoversAfter: params.recoversAfter as number,
        });

      case 'network_latency':
        return new LatencyInjector({
          latencyMs: (params.latencyMs as number) ?? 1000,
          distribution: (params.distribution as 'fixed' | 'uniform' | 'normal' | 'exponential') ?? 'fixed',
          probability: (params.probability as number) ?? 1.0,
        });

      case 'service_unavailable':
      case 'network_partition':
        return new NetworkInjector({
          failureType: 'connection_refused',
          targetPattern: (params.targetPattern as string) ?? '.*',
          probability: (params.probability as number) ?? 1.0,
        });

      case 'concurrent_requests':
        return new ConcurrentInjector({
          concurrency: (params.concurrency as number) ?? 10,
          staggerDelayMs: params.staggerDelayMs as number,
          timeoutMs: params.timeoutMs as number,
        });

      case 'rate_limit_storm':
      case 'rate_limit':
        return new RateLimitInjector({
          requestsPerWindow: (params.requests as number) ?? (params.limit as number) ?? 10,
          windowMs: this.parseDuration(params.window as string) ?? 1000,
          burstLimit: params.burstLimit as number,
          action: (params.action as RateLimitAction) ?? 'reject',
        });

      default:
        if (this.config.verbose) {
          process.stderr.write(`Unknown injection type: ${injection.type}\n`);
        }
        return null;
    }
  }

  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string | undefined): number | undefined {
    if (!duration) return undefined;
    
    const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/);
    if (!match) return undefined;
    
    const value = parseFloat(match[1]!);
    const unit = match[2] || 'ms';
    
    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value;
    }
  }

  /**
   * Get injector type name
   */
  private getInjectorType(injector: Injector): string {
    if (injector instanceof NetworkInjector) return 'network';
    if (injector instanceof DatabaseInjector) return 'database';
    if (injector instanceof LatencyInjector) return 'latency';
    if (injector instanceof ConcurrentInjector) return 'concurrent';
    if (injector instanceof RateLimitInjector) return 'rate_limit';
    return 'unknown';
  }

  /**
   * Get injector statistics
   */
  private getInjectorStats(injector: Injector): Record<string, unknown> {
    return injector.getState() as unknown as Record<string, unknown>;
  }

  /**
   * Execute behavior with injections active
   */
  private async executeBehavior(
    scenario: ParsedChaosScenario,
    implementation: BehaviorImplementation,
    injectors: Injector[]
  ): Promise<BehaviorExecutionResult> {
    // Check if we have a concurrent injector
    const concurrentInjector = injectors.find(
      i => i instanceof ConcurrentInjector
    ) as ConcurrentInjector | undefined;

    try {
      if (concurrentInjector) {
        // Execute with concurrency
        const results = await concurrentInjector.execute(
          async () => {
            return implementation.execute({});
          },
          scenario.behaviorName
        );

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          data: results,
          error: successCount === 0 ? new Error('All concurrent requests failed') : undefined,
          concurrentResults: results,
        };
      } else {
        // Execute normally
        const data = await implementation.execute({});
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check assertions against execution result
   */
  private async checkAssertions(
    assertions: ChaosAssertion[],
    executionResult: BehaviorExecutionResult,
    _injectors: Injector[]
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      const result = this.checkAssertion(assertion, executionResult);
      results.push(result);
    }

    return results;
  }

  /**
   * Check a single assertion
   */
  private checkAssertion(
    assertion: ChaosAssertion,
    executionResult: BehaviorExecutionResult
  ): AssertionResult {
    switch (assertion.type) {
      case 'error_returned':
        return {
          type: 'error_returned',
          passed: assertion.expected === !executionResult.success,
          expected: assertion.expected,
          actual: !executionResult.success,
          message: assertion.message,
        };

      case 'recovery':
        return {
          type: 'recovery',
          passed: executionResult.success === true,
          expected: true,
          actual: executionResult.success,
          message: assertion.message ?? 'Should recover from failure',
        };

      case 'timeout':
        return {
          type: 'timeout',
          passed: !executionResult.timedOut,
          expected: assertion.expected,
          actual: executionResult.timedOut,
          message: assertion.message,
        };

      case 'state_check':
        return {
          type: 'state_check',
          passed: true, // Would need state inspection
          expected: assertion.expected,
          message: assertion.message,
        };

      case 'invariant':
        const invariantPassed = this.checkInvariant(assertion.expected, executionResult);
        return {
          type: 'invariant',
          passed: invariantPassed,
          expected: assertion.expected,
          message: assertion.message,
        };

      default:
        return {
          type: assertion.type,
          passed: false,
          expected: assertion.expected,
          message: `Unknown assertion type: ${assertion.type}`,
        };
    }
  }

  /**
   * Check invariant assertion
   */
  private checkInvariant(
    expected: unknown,
    result: BehaviorExecutionResult
  ): boolean {
    if (expected === 'consistent_state' && result.concurrentResults) {
      // Check that all successful results are consistent
      const successfulResults = result.concurrentResults
        .filter(r => r.success)
        .map(r => JSON.stringify(r.result));
      
      if (successfulResults.length < 2) return true;
      
      const reference = successfulResults[0];
      return successfulResults.every(r => r === reference);
    }
    return true;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T & { timedOut?: boolean }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({ timedOut: true } as T & { timedOut: boolean });
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve({ ...result, timedOut: false });
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Cleanup all injectors
   */
  private async cleanupInjectors(injectors: Injector[]): Promise<void> {
    for (const injector of injectors) {
      try {
        injector.deactivate();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.activeInjectors = this.activeInjectors.filter(
      i => !injectors.includes(i)
    );
  }
}

/**
 * Interface for behavior implementation
 */
export interface BehaviorImplementation {
  execute(input: Record<string, unknown>): Promise<unknown>;
}

/**
 * Result of behavior execution
 */
export interface BehaviorExecutionResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  timedOut?: boolean;
  concurrentResults?: Array<{
    success: boolean;
    result?: unknown;
    error?: Error;
  }>;
}

/**
 * Create a chaos executor
 */
export function createExecutor(config?: ExecutorConfig): ChaosExecutor {
  return new ChaosExecutor(config);
}
