/**
 * Chaos Harness API
 * 
 * Provides a clean API for verifiers to use chaos injection:
 *   startScenario -> runTarget -> captureOutcomes
 * 
 * This is the primary interface for integrating chaos testing
 * into verification pipelines.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type { ParsedChaosScenario } from './scenarios.js';
import { ChaosExecutor, type ScenarioResult, type BehaviorImplementation } from './executor.js';
import { createTimeline, Timeline, type TimelineReport } from './timeline.js';
import { NetworkInjector } from './injectors/network.js';
import { ClockSkewInjector } from './injectors/clock-skew.js';
import { ConcurrentInjector } from './injectors/concurrent.js';
import { LatencyInjector } from './injectors/latency.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface HarnessConfig {
  /** Timeout per scenario (ms) */
  timeoutMs?: number;
  /** Continue on failure */
  continueOnFailure?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export interface ScenarioOutcome {
  /** Scenario name */
  scenarioName: string;
  /** Whether scenario passed */
  passed: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Metrics captured */
  metrics: ScenarioMetrics;
  /** Errors if any */
  errors?: Error[];
  /** Timeline events */
  timeline: TimelineReport;
}

export interface ScenarioMetrics {
  /** Number of injections activated */
  injectionsActivated: number;
  /** Number of errors injected */
  errorsInjected: number;
  /** Total latency injected (ms) */
  totalLatencyInjected: number;
  /** Average latency injected (ms) */
  averageLatencyInjected: number;
  /** Concurrent requests executed */
  concurrentRequests: number;
  /** Clock skew offset applied (ms) */
  clockSkewOffset: number;
  /** Network requests intercepted */
  networkRequestsIntercepted: number;
  /** Network failures injected */
  networkFailuresInjected: number;
}

export interface TrialResult {
  /** Trial number (1-indexed) */
  trial: number;
  /** Outcome */
  outcome: ScenarioOutcome;
}

export interface HarnessResult {
  /** Overall success */
  success: boolean;
  /** All trial results */
  trials: TrialResult[];
  /** Aggregated metrics */
  aggregatedMetrics: AggregatedMetrics;
  /** Total duration */
  totalDurationMs: number;
}

export interface AggregatedMetrics {
  /** Total trials */
  totalTrials: number;
  /** Passed trials */
  passedTrials: number;
  /** Failed trials */
  failedTrials: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration across trials */
  averageDurationMs: number;
  /** Total errors injected across all trials */
  totalErrorsInjected: number;
  /** Total latency injected across all trials */
  totalLatencyInjected: number;
  /** Average latency per trial */
  averageLatencyPerTrial: number;
  /** Total network requests intercepted */
  totalNetworkRequestsIntercepted: number;
  /** Total network failures injected */
  totalNetworkFailuresInjected: number;
}

/* ------------------------------------------------------------------ */
/*  Harness                                                           */
/* ------------------------------------------------------------------ */

/**
 * Chaos harness for verifier integration
 */
export class ChaosHarness {
  private config: Required<HarnessConfig>;
  private executor: ChaosExecutor;
  private timeline: Timeline;

  constructor(config: HarnessConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? 30_000,
      continueOnFailure: config.continueOnFailure ?? true,
      verbose: config.verbose ?? false,
    };
    this.executor = new ChaosExecutor({
      timeoutMs: this.config.timeoutMs,
      continueOnFailure: this.config.continueOnFailure,
      verbose: this.config.verbose,
    });
    this.timeline = createTimeline();
  }

  /**
   * Start a chaos scenario
   * Returns a scenario runner that can execute the target and capture outcomes
   */
  startScenario(
    scenario: ParsedChaosScenario,
    domain: DomainDeclaration
  ): ScenarioRunner {
    return new ScenarioRunner(
      scenario,
      domain,
      this.executor,
      this.timeline,
      this.config
    );
  }

  /**
   * Run N trials of a scenario
   */
  async runTrials(
    scenario: ParsedChaosScenario,
    domain: DomainDeclaration,
    implementation: BehaviorImplementation,
    numTrials: number
  ): Promise<HarnessResult> {
    const startTime = Date.now();
    const trials: TrialResult[] = [];

    for (let i = 1; i <= numTrials; i++) {
      const runner = this.startScenario(scenario, domain);
      const outcome = await runner.runTarget(implementation);
      
      trials.push({
        trial: i,
        outcome,
      });

      if (!this.config.continueOnFailure && !outcome.passed) {
        break;
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const aggregatedMetrics = this.aggregateMetrics(trials);

    return {
      success: trials.every(t => t.outcome.passed),
      trials,
      aggregatedMetrics,
      totalDurationMs,
    };
  }

  /**
   * Aggregate metrics across trials
   */
  private aggregateMetrics(trials: TrialResult[]): AggregatedMetrics {
    const passedTrials = trials.filter(t => t.outcome.passed).length;
    const failedTrials = trials.length - passedTrials;
    
    const totalErrorsInjected = trials.reduce(
      (sum, t) => sum + t.outcome.metrics.errorsInjected,
      0
    );
    
    const totalLatencyInjected = trials.reduce(
      (sum, t) => sum + t.outcome.metrics.totalLatencyInjected,
      0
    );
    
    const totalNetworkRequestsIntercepted = trials.reduce(
      (sum, t) => sum + t.outcome.metrics.networkRequestsIntercepted,
      0
    );
    
    const totalNetworkFailuresInjected = trials.reduce(
      (sum, t) => sum + t.outcome.metrics.networkFailuresInjected,
      0
    );
    
    const averageDurationMs = trials.length > 0
      ? trials.reduce((sum, t) => sum + t.outcome.durationMs, 0) / trials.length
      : 0;

    return {
      totalTrials: trials.length,
      passedTrials,
      failedTrials,
      successRate: trials.length > 0 ? passedTrials / trials.length : 0,
      averageDurationMs,
      totalErrorsInjected,
      totalLatencyInjected,
      averageLatencyPerTrial: trials.length > 0 ? totalLatencyInjected / trials.length : 0,
      totalNetworkRequestsIntercepted,
      totalNetworkFailuresInjected,
    };
  }
}

/**
 * Scenario runner - executes a single scenario and captures outcomes
 */
export class ScenarioRunner {
  private scenario: ParsedChaosScenario;
  private domain: DomainDeclaration;
  private executor: ChaosExecutor;
  private timeline: Timeline;
  private config: Required<HarnessConfig>;

  constructor(
    scenario: ParsedChaosScenario,
    domain: DomainDeclaration,
    executor: ChaosExecutor,
    timeline: Timeline,
    config: Required<HarnessConfig>
  ) {
    this.scenario = scenario;
    this.domain = domain;
    this.executor = executor;
    this.timeline = timeline;
    this.config = config;
  }

  /**
   * Run the target implementation with chaos injections
   */
  async runTarget(implementation: BehaviorImplementation): Promise<ScenarioOutcome> {
    const startTime = Date.now();
    
    try {
      const result = await this.executor.executeScenario(
        this.scenario,
        this.domain,
        implementation
      );

      const metrics = this.extractMetrics(result);
      const durationMs = Date.now() - startTime;

      return {
        scenarioName: this.scenario.name,
        passed: result.passed,
        durationMs,
        metrics,
        errors: result.error ? [result.error] : undefined,
        timeline: result.timeline,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        scenarioName: this.scenario.name,
        passed: false,
        durationMs,
        metrics: this.createEmptyMetrics(),
        errors: [error instanceof Error ? error : new Error(String(error))],
        timeline: this.timeline.generateReport(),
      };
    }
  }

  /**
   * Extract metrics from scenario result
   */
  private extractMetrics(result: ScenarioResult): ScenarioMetrics {
    const metrics: ScenarioMetrics = {
      injectionsActivated: result.injections.length,
      errorsInjected: 0,
      totalLatencyInjected: 0,
      averageLatencyInjected: 0,
      concurrentRequests: 0,
      clockSkewOffset: 0,
      networkRequestsIntercepted: 0,
      networkFailuresInjected: 0,
    };

    for (const injection of result.injections) {
      const stats = injection.stats as Record<string, unknown>;
      
      // Network injector stats
      if (injection.type === 'network') {
        metrics.networkRequestsIntercepted = (stats.interceptedRequests as number) ?? 0;
        metrics.networkFailuresInjected = (stats.failedRequests as number) ?? 0;
        metrics.totalLatencyInjected += (stats.totalLatencyInjected as number) ?? 0;
        metrics.errorsInjected += metrics.networkFailuresInjected;
      }
      
      // Latency injector stats
      if (injection.type === 'latency') {
        metrics.totalLatencyInjected += (stats.totalLatencyAdded as number) ?? 0;
        const opsDelayed = (stats.operationsDelayed as number) ?? 0;
        if (opsDelayed > 0) {
          metrics.averageLatencyInjected = (stats.averageLatency as number) ?? 0;
        }
      }
      
      // Concurrent injector stats
      if (injection.type === 'concurrent') {
        metrics.concurrentRequests = (stats.totalRequests as number) ?? 0;
      }
      
      // Clock skew injector stats
      if (injection.type === 'clock_skew') {
        metrics.clockSkewOffset = Math.abs((stats.currentOffsetMs as number) ?? 0);
      }
    }

    // Calculate average latency
    if (metrics.injectionsActivated > 0) {
      metrics.averageLatencyInjected = metrics.totalLatencyInjected / metrics.injectionsActivated;
    }

    return metrics;
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): ScenarioMetrics {
    return {
      injectionsActivated: 0,
      errorsInjected: 0,
      totalLatencyInjected: 0,
      averageLatencyInjected: 0,
      concurrentRequests: 0,
      clockSkewOffset: 0,
      networkRequestsIntercepted: 0,
      networkFailuresInjected: 0,
    };
  }
}

/**
 * Create a chaos harness
 */
export function createHarness(config?: HarnessConfig): ChaosHarness {
  return new ChaosHarness(config);
}
