// ============================================================================
// Verification Metrics - Track verification runs and results
// ============================================================================

import {
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import type { VerifyMetricResult, Verdict } from '../types';

/**
 * Verification metrics collection
 */
export class VerificationMetrics {
  /** Total verifications counter */
  readonly total: Counter<'domain' | 'behavior' | 'verdict'>;
  
  /** Current verification score gauge */
  readonly score: Gauge<'domain' | 'behavior'>;
  
  /** Verification duration histogram */
  readonly duration: Histogram<'domain' | 'behavior'>;
  
  /** Last verification timestamp */
  readonly lastVerification: Gauge<'domain' | 'behavior'>;
  
  /** Verification success rate */
  readonly successRate: Gauge<'domain' | 'behavior'>;

  constructor(registry: Registry, prefix: string, durationBuckets: number[]) {
    this.total = new Counter({
      name: `${prefix}verification_total`,
      help: 'Total verifications run',
      labelNames: ['domain', 'behavior', 'verdict'] as const,
      registers: [registry],
    });

    this.score = new Gauge({
      name: `${prefix}verification_score`,
      help: 'Verification score (0-100)',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.duration = new Histogram({
      name: `${prefix}verification_duration_seconds`,
      help: 'Verification duration in seconds',
      labelNames: ['domain', 'behavior'] as const,
      buckets: durationBuckets,
      registers: [registry],
    });

    this.lastVerification = new Gauge({
      name: `${prefix}verification_last_timestamp`,
      help: 'Timestamp of last verification',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.successRate = new Gauge({
      name: `${prefix}verification_success_rate`,
      help: 'Rolling success rate (verified/total)',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });
  }

  /**
   * Record a verification result
   */
  record(result: VerifyMetricResult): void {
    const { domain, behavior, verdict, score, duration } = result;

    // Increment counter
    this.total.inc({ domain, behavior, verdict });

    // Update score
    this.score.set({ domain, behavior }, score);

    // Record duration
    this.duration.observe({ domain, behavior }, duration);

    // Update last verification timestamp
    this.lastVerification.set({ domain, behavior }, Date.now() / 1000);

    // Update success rate (requires tracking state)
    this.updateSuccessRate(domain, behavior, verdict);
  }

  // Track verification counts for success rate calculation
  private verificationCounts = new Map<string, { verified: number; total: number }>();

  private updateSuccessRate(domain: string, behavior: string, verdict: Verdict): void {
    const key = `${domain}:${behavior}`;
    
    if (!this.verificationCounts.has(key)) {
      this.verificationCounts.set(key, { verified: 0, total: 0 });
    }

    const counts = this.verificationCounts.get(key)!;
    counts.total++;
    if (verdict === 'verified') {
      counts.verified++;
    }

    const rate = counts.total > 0 ? counts.verified / counts.total : 0;
    this.successRate.set({ domain, behavior }, rate);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.total.reset();
    this.score.reset();
    this.duration.reset();
    this.lastVerification.reset();
    this.successRate.reset();
    this.verificationCounts.clear();
  }
}
