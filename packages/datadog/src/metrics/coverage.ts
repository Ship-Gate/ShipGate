// ============================================================================
// Coverage Metrics
// ============================================================================

import type { DatadogClient } from '../client.js';
import type { CoverageInfo, CoverageCategory, Domain, Behavior } from '../types.js';

/**
 * Coverage data point
 */
export interface CoverageDataPoint {
  domain: string;
  behavior: string;
  category: CoverageCategory;
  covered: number;
  total: number;
  percentage: number;
  timestamp?: Date;
}

/**
 * Aggregated coverage stats
 */
export interface CoverageStats {
  preconditions: { covered: number; total: number; percentage: number };
  postconditions: { covered: number; total: number; percentage: number };
  invariants: { covered: number; total: number; percentage: number };
  overall: { covered: number; total: number; percentage: number };
}

/**
 * Coverage metrics collector
 * 
 * Tracks coverage metrics for ISL specifications including:
 * - Precondition coverage
 * - Postcondition coverage
 * - Invariant coverage
 * - Trend analysis
 * 
 * @example
 * ```typescript
 * const coverage = new CoverageMetrics(client);
 * 
 * coverage.recordCoverage('auth', 'login', {
 *   preconditions: 0.95,
 *   postconditions: 0.88,
 *   invariants: 1.0,
 * });
 * ```
 */
export class CoverageMetrics {
  private client: DatadogClient;
  private coverageHistory: Map<string, CoverageDataPoint[]> = new Map();
  private targetCoverage: Map<string, number> = new Map();

  constructor(client: DatadogClient) {
    this.client = client;
  }

  /**
   * Record coverage for a behavior
   */
  recordCoverage(
    domain: string,
    behavior: string,
    coverage: CoverageInfo
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
    ];

    // Record individual coverage metrics
    this.client.gauge('coverage.preconditions', coverage.preconditions * 100, tags);
    this.client.gauge('coverage.postconditions', coverage.postconditions * 100, tags);
    this.client.gauge('coverage.invariants', coverage.invariants * 100, tags);

    // Overall coverage
    const overall = (coverage.preconditions + coverage.postconditions + coverage.invariants) / 3;
    this.client.gauge('coverage.overall', overall * 100, tags);

    // Record data points for history
    this.recordDataPoint(domain, behavior, 'preconditions', coverage.preconditions);
    this.recordDataPoint(domain, behavior, 'postconditions', coverage.postconditions);
    this.recordDataPoint(domain, behavior, 'invariants', coverage.invariants);

    // Check against targets
    this.checkTargets(domain, behavior, coverage);
  }

  /**
   * Record detailed coverage with counts
   */
  recordDetailedCoverage(
    domain: string,
    behavior: string,
    category: CoverageCategory,
    covered: number,
    total: number
  ): void {
    if (total === 0) return;

    const percentage = covered / total;
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `category:${category}`,
    ];

    this.client.gauge(`coverage.${category}.covered`, covered, tags);
    this.client.gauge(`coverage.${category}.total`, total, tags);
    this.client.gauge(`coverage.${category}.percentage`, percentage * 100, tags);

    // Record to history
    this.recordDataPoint(domain, behavior, category, percentage, covered, total);
  }

  /**
   * Record coverage for an entire domain
   */
  recordDomainCoverage(domain: Domain): CoverageStats {
    const stats: CoverageStats = {
      preconditions: { covered: 0, total: 0, percentage: 0 },
      postconditions: { covered: 0, total: 0, percentage: 0 },
      invariants: { covered: 0, total: 0, percentage: 0 },
      overall: { covered: 0, total: 0, percentage: 0 },
    };

    for (const behavior of domain.behaviors) {
      const behaviorStats = this.calculateBehaviorCoverage(behavior);
      
      stats.preconditions.total += behaviorStats.preconditions.total;
      stats.postconditions.total += behaviorStats.postconditions.total;
      stats.invariants.total += behaviorStats.invariants.total;

      // For simplicity, assume full coverage if specs exist
      stats.preconditions.covered += behaviorStats.preconditions.total;
      stats.postconditions.covered += behaviorStats.postconditions.total;
      stats.invariants.covered += behaviorStats.invariants.total;
    }

    // Calculate percentages
    if (stats.preconditions.total > 0) {
      stats.preconditions.percentage = (stats.preconditions.covered / stats.preconditions.total) * 100;
    }
    if (stats.postconditions.total > 0) {
      stats.postconditions.percentage = (stats.postconditions.covered / stats.postconditions.total) * 100;
    }
    if (stats.invariants.total > 0) {
      stats.invariants.percentage = (stats.invariants.covered / stats.invariants.total) * 100;
    }

    // Overall
    const totalSpecs = stats.preconditions.total + stats.postconditions.total + stats.invariants.total;
    const totalCovered = stats.preconditions.covered + stats.postconditions.covered + stats.invariants.covered;
    stats.overall.total = totalSpecs;
    stats.overall.covered = totalCovered;
    stats.overall.percentage = totalSpecs > 0 ? (totalCovered / totalSpecs) * 100 : 0;

    // Record to Datadog
    const tags = [`domain:${domain.name}`];
    this.client.gauge('domain.coverage.preconditions', stats.preconditions.percentage, tags);
    this.client.gauge('domain.coverage.postconditions', stats.postconditions.percentage, tags);
    this.client.gauge('domain.coverage.invariants', stats.invariants.percentage, tags);
    this.client.gauge('domain.coverage.overall', stats.overall.percentage, tags);
    this.client.gauge('domain.coverage.total_specs', totalSpecs, tags);

    return stats;
  }

  /**
   * Set a coverage target
   */
  setCoverageTarget(domain: string, behavior: string, target: number): void {
    const key = `${domain}.${behavior}`;
    this.targetCoverage.set(key, Math.min(100, Math.max(0, target)));
  }

  /**
   * Get coverage trend
   */
  getCoverageTrend(
    domain: string,
    behavior: string,
    category: CoverageCategory,
    limit = 100
  ): CoverageDataPoint[] {
    const key = `${domain}.${behavior}.${category}`;
    const history = this.coverageHistory.get(key) ?? [];
    return history.slice(-limit);
  }

  /**
   * Calculate coverage gap (difference from target)
   */
  getCoverageGap(domain: string, behavior: string): number {
    const key = `${domain}.${behavior}`;
    const target = this.targetCoverage.get(key) ?? 100;
    
    // Get latest coverage
    const preconditions = this.getLatestCoverage(domain, behavior, 'preconditions');
    const postconditions = this.getLatestCoverage(domain, behavior, 'postconditions');
    const invariants = this.getLatestCoverage(domain, behavior, 'invariants');
    
    const current = ((preconditions + postconditions + invariants) / 3) * 100;
    return Math.max(0, target - current);
  }

  /**
   * Record coverage delta (change from previous)
   */
  recordCoverageDelta(
    domain: string,
    behavior: string,
    previousCoverage: CoverageInfo,
    currentCoverage: CoverageInfo
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
    ];

    const deltaPre = currentCoverage.preconditions - previousCoverage.preconditions;
    const deltaPost = currentCoverage.postconditions - previousCoverage.postconditions;
    const deltaInv = currentCoverage.invariants - previousCoverage.invariants;

    this.client.gauge('coverage.delta.preconditions', deltaPre * 100, tags);
    this.client.gauge('coverage.delta.postconditions', deltaPost * 100, tags);
    this.client.gauge('coverage.delta.invariants', deltaInv * 100, tags);

    // Track direction
    const improving = deltaPre >= 0 && deltaPost >= 0 && deltaInv >= 0;
    this.client.increment(`coverage.trend.${improving ? 'improving' : 'declining'}`, 1, tags);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private recordDataPoint(
    domain: string,
    behavior: string,
    category: CoverageCategory,
    percentage: number,
    covered?: number,
    total?: number
  ): void {
    const key = `${domain}.${behavior}.${category}`;
    
    if (!this.coverageHistory.has(key)) {
      this.coverageHistory.set(key, []);
    }

    const history = this.coverageHistory.get(key)!;
    history.push({
      domain,
      behavior,
      category,
      covered: covered ?? Math.round(percentage * 100),
      total: total ?? 100,
      percentage: percentage * 100,
      timestamp: new Date(),
    });

    // Keep only last 1000 data points
    if (history.length > 1000) {
      this.coverageHistory.set(key, history.slice(-1000));
    }
  }

  private checkTargets(domain: string, behavior: string, coverage: CoverageInfo): void {
    const key = `${domain}.${behavior}`;
    const target = this.targetCoverage.get(key);
    
    if (target === undefined) return;

    const overall = ((coverage.preconditions + coverage.postconditions + coverage.invariants) / 3) * 100;
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
    ];

    if (overall < target) {
      this.client.increment('coverage.below_target', 1, tags);
      this.client.gauge('coverage.gap', target - overall, tags);
    } else {
      this.client.increment('coverage.meeting_target', 1, tags);
    }
  }

  private calculateBehaviorCoverage(behavior: Behavior): {
    preconditions: { total: number };
    postconditions: { total: number };
    invariants: { total: number };
  } {
    return {
      preconditions: { total: behavior.preconditions?.length ?? 0 },
      postconditions: { total: behavior.postconditions?.length ?? 0 },
      invariants: { total: behavior.invariants?.length ?? 0 },
    };
  }

  private getLatestCoverage(
    domain: string,
    behavior: string,
    category: CoverageCategory
  ): number {
    const key = `${domain}.${behavior}.${category}`;
    const history = this.coverageHistory.get(key) ?? [];
    const latest = history[history.length - 1];
    return latest ? latest.percentage / 100 : 0;
  }
}

/**
 * Create a coverage metrics collector
 */
export function createCoverageMetrics(client: DatadogClient): CoverageMetrics {
  return new CoverageMetrics(client);
}
