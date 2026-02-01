// ============================================================================
// Verification Metrics
// ============================================================================

import type { DatadogClient } from '../client.js';
import type { VerifyResult, CheckResult, Verdict, Domain } from '../types.js';

/**
 * Verification metrics collector
 * 
 * Specialized metrics for ISL verification tracking including:
 * - Verification counts and outcomes
 * - Scores and trends
 * - Check-level metrics
 * - Behavior-specific aggregations
 * 
 * @example
 * ```typescript
 * const metrics = new VerificationMetrics(client);
 * 
 * metrics.recordVerification({
 *   domain: 'payments',
 *   behavior: 'processPayment',
 *   verdict: 'verified',
 *   score: 98,
 *   duration: 45,
 *   coverage: { preconditions: 1, postconditions: 1, invariants: 1 },
 * });
 * ```
 */
export class VerificationMetrics {
  private client: DatadogClient;
  private verdictCounts: Map<string, Map<Verdict, number>> = new Map();
  private scoreTrend: Map<string, number[]> = new Map();

  constructor(client: DatadogClient) {
    this.client = client;
  }

  /**
   * Record a complete verification result
   */
  recordVerification(result: VerifyResult): void {
    // Delegate to main client
    this.client.recordVerification(result);

    // Track local aggregations
    this.trackVerdict(result);
    this.trackScore(result);

    // Record additional computed metrics
    this.recordComputedMetrics(result);
  }

  /**
   * Record an individual check
   */
  recordCheck(check: CheckResult): void {
    this.client.recordCheck(check);
  }

  /**
   * Record batch verification results
   */
  recordBatch(results: VerifyResult[]): void {
    for (const result of results) {
      this.recordVerification(result);
    }

    // Record batch-level metrics
    if (results.length > 0) {
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const passRate = results.filter(r => r.verdict === 'verified').length / results.length;

      this.client.gauge('verification.batch.avg_score', avgScore);
      this.client.gauge('verification.batch.avg_duration', avgDuration);
      this.client.gauge('verification.batch.pass_rate', passRate * 100);
      this.client.gauge('verification.batch.size', results.length);
    }
  }

  /**
   * Record verification for an entire domain
   */
  recordDomainVerification(
    domain: Domain,
    results: Map<string, VerifyResult>
  ): void {
    const tags = [`domain:${domain.name}`];
    
    let totalScore = 0;
    let verifiedCount = 0;
    let riskyCount = 0;
    let unsafeCount = 0;

    for (const [behaviorName, result] of results) {
      this.recordVerification({ ...result, domain: domain.name, behavior: behaviorName });
      
      totalScore += result.score;
      switch (result.verdict) {
        case 'verified':
          verifiedCount++;
          break;
        case 'risky':
          riskyCount++;
          break;
        case 'unsafe':
          unsafeCount++;
          break;
      }
    }

    // Domain-level aggregates
    const count = results.size;
    if (count > 0) {
      this.client.gauge('domain.avg_score', totalScore / count, tags);
      this.client.gauge('domain.verified_count', verifiedCount, tags);
      this.client.gauge('domain.risky_count', riskyCount, tags);
      this.client.gauge('domain.unsafe_count', unsafeCount, tags);
      this.client.gauge('domain.behavior_count', count, tags);
      this.client.gauge('domain.health', (verifiedCount / count) * 100, tags);
    }
  }

  /**
   * Record a verification failure with details
   */
  recordFailure(
    domain: string,
    behavior: string,
    reason: string,
    error?: Error
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `reason:${reason}`,
    ];

    this.client.increment('verification.failure', 1, tags);

    if (error) {
      this.client.increment('verification.error', 1, [
        ...tags,
        `error_type:${error.name}`,
      ]);
    }
  }

  /**
   * Record verification retry
   */
  recordRetry(
    domain: string,
    behavior: string,
    attempt: number,
    reason: string
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `attempt:${attempt}`,
      `reason:${reason}`,
    ];

    this.client.increment('verification.retry', 1, tags);
  }

  /**
   * Get verdict distribution for a behavior
   */
  getVerdictDistribution(domain: string, behavior: string): Map<Verdict, number> {
    const key = `${domain}.${behavior}`;
    return this.verdictCounts.get(key) ?? new Map();
  }

  /**
   * Get score trend for a behavior
   */
  getScoreTrend(domain: string, behavior: string, limit = 100): number[] {
    const key = `${domain}.${behavior}`;
    const scores = this.scoreTrend.get(key) ?? [];
    return scores.slice(-limit);
  }

  /**
   * Calculate verification rate (verifications per second)
   */
  recordVerificationRate(
    domain: string,
    behavior: string,
    verificationsPerSecond: number
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
    ];

    this.client.gauge('verification.rate', verificationsPerSecond, tags);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private trackVerdict(result: VerifyResult): void {
    const key = `${result.domain}.${result.behavior}`;
    
    if (!this.verdictCounts.has(key)) {
      this.verdictCounts.set(key, new Map());
    }

    const counts = this.verdictCounts.get(key)!;
    counts.set(result.verdict, (counts.get(result.verdict) ?? 0) + 1);
  }

  private trackScore(result: VerifyResult): void {
    const key = `${result.domain}.${result.behavior}`;
    
    if (!this.scoreTrend.has(key)) {
      this.scoreTrend.set(key, []);
    }

    const scores = this.scoreTrend.get(key)!;
    scores.push(result.score);

    // Keep only last 1000 scores
    if (scores.length > 1000) {
      this.scoreTrend.set(key, scores.slice(-1000));
    }
  }

  private recordComputedMetrics(result: VerifyResult): void {
    const tags = [
      `domain:${result.domain}`,
      `behavior:${result.behavior}`,
    ];

    // Compute overall coverage
    const coverage = result.coverage;
    const overallCoverage = (coverage.preconditions + coverage.postconditions + coverage.invariants) / 3;
    this.client.gauge('verification.coverage.overall', overallCoverage * 100, tags);

    // Risk indicator (inverse of score)
    const riskIndicator = Math.max(0, 100 - result.score);
    this.client.gauge('verification.risk_indicator', riskIndicator, tags);

    // Verification throughput (ops per second based on duration)
    if (result.duration > 0) {
      const throughput = 1000 / result.duration;
      this.client.gauge('verification.throughput', throughput, tags);
    }
  }
}

/**
 * Create a verification metrics collector
 */
export function createVerificationMetrics(client: DatadogClient): VerificationMetrics {
  return new VerificationMetrics(client);
}
