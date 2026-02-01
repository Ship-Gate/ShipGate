// ============================================================================
// Chaos Test Metrics - Track chaos engineering test results
// ============================================================================

import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { ChaosMetricResult, ChaosTestResult } from '../types';

/**
 * Chaos test metrics collection
 */
export class ChaosMetrics {
  /** Total chaos tests counter */
  readonly total: Counter<'domain' | 'scenario' | 'result'>;
  
  /** Chaos test duration histogram */
  readonly duration: Histogram<'domain' | 'scenario'>;
  
  /** Chaos test success rate */
  readonly successRate: Gauge<'domain' | 'scenario'>;
  
  /** Active chaos scenarios */
  readonly activeScenarios: Gauge<'domain'>;
  
  /** Last chaos test timestamp */
  readonly lastTest: Gauge<'domain' | 'scenario'>;
  
  /** Resilience score (based on chaos test pass rate) */
  readonly resilienceScore: Gauge<'domain'>;

  constructor(registry: Registry, prefix: string) {
    this.total = new Counter({
      name: `${prefix}chaos_test_total`,
      help: 'Total chaos tests run',
      labelNames: ['domain', 'scenario', 'result'] as const,
      registers: [registry],
    });

    this.duration = new Histogram({
      name: `${prefix}chaos_test_duration_seconds`,
      help: 'Chaos test duration in seconds',
      labelNames: ['domain', 'scenario'] as const,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [registry],
    });

    this.successRate = new Gauge({
      name: `${prefix}chaos_test_success_rate`,
      help: 'Chaos test success rate by scenario',
      labelNames: ['domain', 'scenario'] as const,
      registers: [registry],
    });

    this.activeScenarios = new Gauge({
      name: `${prefix}chaos_active_scenarios`,
      help: 'Number of active chaos scenarios',
      labelNames: ['domain'] as const,
      registers: [registry],
    });

    this.lastTest = new Gauge({
      name: `${prefix}chaos_test_last_timestamp`,
      help: 'Timestamp of last chaos test',
      labelNames: ['domain', 'scenario'] as const,
      registers: [registry],
    });

    this.resilienceScore = new Gauge({
      name: `${prefix}resilience_score`,
      help: 'Overall resilience score based on chaos tests (0-100)',
      labelNames: ['domain'] as const,
      registers: [registry],
    });
  }

  // Track test counts for success rate calculation
  private testCounts = new Map<string, { pass: number; fail: number }>();
  private scenarios = new Map<string, Set<string>>();

  /**
   * Record a chaos test result
   */
  record(result: ChaosMetricResult): void {
    const { domain, scenario, result: testResult, duration } = result;

    // Increment counter
    this.total.inc({ domain, scenario, result: testResult });

    // Record duration if provided
    if (duration !== undefined) {
      this.duration.observe({ domain, scenario }, duration);
    }

    // Update last test timestamp
    this.lastTest.set({ domain, scenario }, Date.now() / 1000);

    // Track for success rate
    this.trackResult(domain, scenario, testResult);

    // Update success rate
    this.updateSuccessRate(domain, scenario);

    // Track active scenarios
    this.trackScenario(domain, scenario);

    // Update resilience score
    this.updateResilienceScore(domain);
  }

  private trackResult(domain: string, scenario: string, result: ChaosTestResult): void {
    const key = `${domain}:${scenario}`;
    
    if (!this.testCounts.has(key)) {
      this.testCounts.set(key, { pass: 0, fail: 0 });
    }
    
    const counts = this.testCounts.get(key)!;
    if (result === 'pass') {
      counts.pass++;
    } else {
      counts.fail++;
    }
  }

  private updateSuccessRate(domain: string, scenario: string): void {
    const key = `${domain}:${scenario}`;
    const counts = this.testCounts.get(key);
    
    if (!counts) return;
    
    const total = counts.pass + counts.fail;
    const rate = total > 0 ? counts.pass / total : 0;
    
    this.successRate.set({ domain, scenario }, rate);
  }

  private trackScenario(domain: string, scenario: string): void {
    if (!this.scenarios.has(domain)) {
      this.scenarios.set(domain, new Set());
    }
    
    this.scenarios.get(domain)!.add(scenario);
    this.activeScenarios.set({ domain }, this.scenarios.get(domain)!.size);
  }

  private updateResilienceScore(domain: string): void {
    const scenarios = this.scenarios.get(domain);
    
    if (!scenarios || scenarios.size === 0) {
      this.resilienceScore.set({ domain }, 100);
      return;
    }
    
    let totalRate = 0;
    let scenarioCount = 0;
    
    for (const scenario of scenarios) {
      const key = `${domain}:${scenario}`;
      const counts = this.testCounts.get(key);
      
      if (counts) {
        const total = counts.pass + counts.fail;
        if (total > 0) {
          totalRate += counts.pass / total;
          scenarioCount++;
        }
      }
    }
    
    const score = scenarioCount > 0 ? (totalRate / scenarioCount) * 100 : 100;
    this.resilienceScore.set({ domain }, score);
  }

  /**
   * Get chaos test statistics for a scenario
   */
  getStats(domain: string, scenario: string): { pass: number; fail: number; rate: number } {
    const key = `${domain}:${scenario}`;
    const counts = this.testCounts.get(key) ?? { pass: 0, fail: 0 };
    const total = counts.pass + counts.fail;
    
    return {
      ...counts,
      rate: total > 0 ? counts.pass / total : 0,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.total.reset();
    this.duration.reset();
    this.successRate.reset();
    this.activeScenarios.reset();
    this.lastTest.reset();
    this.resilienceScore.reset();
    this.testCounts.clear();
    this.scenarios.clear();
  }
}
