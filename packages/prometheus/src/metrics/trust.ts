// ============================================================================
// Trust Score Metrics - Track verification trust scores
// ============================================================================

import { Gauge, Registry } from 'prom-client';
import type { TrustScoreMetric, Verdict } from '../types';

/**
 * Trust score metrics collection
 */
export class TrustMetrics {
  /** Domain-level trust score */
  readonly domainScore: Gauge<'domain'>;
  
  /** Behavior-level trust score */
  readonly behaviorScore: Gauge<'domain' | 'behavior'>;
  
  /** Trust score trend (change from previous) */
  readonly scoreTrend: Gauge<'domain'>;
  
  /** Trust level classification */
  readonly trustLevel: Gauge<'domain' | 'level'>;
  
  /** Behaviors at risk count */
  readonly behaviorsAtRisk: Gauge<'domain'>;
  
  /** Unsafe behaviors count */
  readonly unsafeBehaviors: Gauge<'domain'>;

  constructor(registry: Registry, prefix: string) {
    this.domainScore = new Gauge({
      name: `${prefix}trust_score`,
      help: 'Trust score for domain (0-100)',
      labelNames: ['domain'] as const,
      registers: [registry],
    });

    this.behaviorScore = new Gauge({
      name: `${prefix}trust_score_behavior`,
      help: 'Trust score for specific behavior (0-100)',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.scoreTrend = new Gauge({
      name: `${prefix}trust_score_trend`,
      help: 'Trust score trend (positive=improving, negative=degrading)',
      labelNames: ['domain'] as const,
      registers: [registry],
    });

    this.trustLevel = new Gauge({
      name: `${prefix}trust_level`,
      help: 'Trust level classification (1=verified, 0.5=risky, 0=unsafe)',
      labelNames: ['domain', 'level'] as const,
      registers: [registry],
    });

    this.behaviorsAtRisk = new Gauge({
      name: `${prefix}behaviors_at_risk`,
      help: 'Number of behaviors with risky verdict',
      labelNames: ['domain'] as const,
      registers: [registry],
    });

    this.unsafeBehaviors = new Gauge({
      name: `${prefix}behaviors_unsafe`,
      help: 'Number of behaviors with unsafe verdict',
      labelNames: ['domain'] as const,
      registers: [registry],
    });
  }

  // Track scores for trend calculation
  private previousScores = new Map<string, number>();
  private behaviorVerdicts = new Map<string, Map<string, Verdict>>();

  /**
   * Record a trust score
   */
  record(metric: TrustScoreMetric): void {
    const { domain, score, behavior } = metric;

    if (behavior) {
      // Behavior-specific score
      this.behaviorScore.set({ domain, behavior }, score);
    } else {
      // Domain-level score
      const previous = this.previousScores.get(domain);
      
      this.domainScore.set({ domain }, score);
      
      // Calculate trend
      if (previous !== undefined) {
        const trend = score - previous;
        this.scoreTrend.set({ domain }, trend);
      }
      
      this.previousScores.set(domain, score);
      
      // Update trust level
      this.updateTrustLevel(domain, score);
    }
  }

  /**
   * Record a behavior verdict for domain trust calculation
   */
  recordBehaviorVerdict(domain: string, behavior: string, verdict: Verdict): void {
    if (!this.behaviorVerdicts.has(domain)) {
      this.behaviorVerdicts.set(domain, new Map());
    }
    
    this.behaviorVerdicts.get(domain)!.set(behavior, verdict);
    
    // Update risk counts
    this.updateRiskCounts(domain);
  }

  private updateTrustLevel(domain: string, score: number): void {
    // Clear previous levels
    this.trustLevel.set({ domain, level: 'verified' }, 0);
    this.trustLevel.set({ domain, level: 'risky' }, 0);
    this.trustLevel.set({ domain, level: 'unsafe' }, 0);
    
    // Set current level
    if (score >= 90) {
      this.trustLevel.set({ domain, level: 'verified' }, 1);
    } else if (score >= 70) {
      this.trustLevel.set({ domain, level: 'risky' }, 1);
    } else {
      this.trustLevel.set({ domain, level: 'unsafe' }, 1);
    }
  }

  private updateRiskCounts(domain: string): void {
    const verdicts = this.behaviorVerdicts.get(domain);
    
    if (!verdicts) {
      this.behaviorsAtRisk.set({ domain }, 0);
      this.unsafeBehaviors.set({ domain }, 0);
      return;
    }
    
    let atRisk = 0;
    let unsafe = 0;
    
    for (const verdict of verdicts.values()) {
      if (verdict === 'risky') atRisk++;
      if (verdict === 'unsafe') unsafe++;
    }
    
    this.behaviorsAtRisk.set({ domain }, atRisk);
    this.unsafeBehaviors.set({ domain }, unsafe);
  }

  /**
   * Calculate domain trust score from behavior scores
   */
  calculateDomainScore(domain: string): number {
    const verdicts = this.behaviorVerdicts.get(domain);
    
    if (!verdicts || verdicts.size === 0) {
      return 100;
    }
    
    let totalScore = 0;
    
    for (const verdict of verdicts.values()) {
      switch (verdict) {
        case 'verified':
          totalScore += 100;
          break;
        case 'risky':
          totalScore += 70;
          break;
        case 'unsafe':
          totalScore += 0;
          break;
      }
    }
    
    return totalScore / verdicts.size;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.domainScore.reset();
    this.behaviorScore.reset();
    this.scoreTrend.reset();
    this.trustLevel.reset();
    this.behaviorsAtRisk.reset();
    this.unsafeBehaviors.reset();
    this.previousScores.clear();
    this.behaviorVerdicts.clear();
  }
}
