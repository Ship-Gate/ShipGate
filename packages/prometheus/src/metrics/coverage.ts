// ============================================================================
// Coverage Metrics - Track verification coverage
// ============================================================================

import { Gauge, Registry } from 'prom-client';
import type { CoverageInfo, CoverageCategory } from '../types';

/**
 * Coverage metrics collection
 */
export class CoverageMetrics {
  /** Coverage ratio by category */
  readonly ratio: Gauge<'domain' | 'behavior' | 'category'>;
  
  /** Overall coverage */
  readonly overall: Gauge<'domain' | 'behavior'>;
  
  /** Total checks by category */
  readonly totalChecks: Gauge<'domain' | 'behavior' | 'category'>;
  
  /** Passed checks by category */
  readonly passedChecks: Gauge<'domain' | 'behavior' | 'category'>;

  constructor(registry: Registry, prefix: string) {
    this.ratio = new Gauge({
      name: `${prefix}coverage_ratio`,
      help: 'Coverage percentage by category (0-1)',
      labelNames: ['domain', 'behavior', 'category'] as const,
      registers: [registry],
    });

    this.overall = new Gauge({
      name: `${prefix}coverage_overall`,
      help: 'Overall coverage percentage (0-1)',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.totalChecks = new Gauge({
      name: `${prefix}coverage_total_checks`,
      help: 'Total number of checks by category',
      labelNames: ['domain', 'behavior', 'category'] as const,
      registers: [registry],
    });

    this.passedChecks = new Gauge({
      name: `${prefix}coverage_passed_checks`,
      help: 'Number of passed checks by category',
      labelNames: ['domain', 'behavior', 'category'] as const,
      registers: [registry],
    });
  }

  /**
   * Record coverage information
   */
  record(domain: string, behavior: string, coverage: CoverageInfo): void {
    const categories: CoverageCategory[] = ['preconditions', 'postconditions', 'invariants'];
    
    let totalPassed = 0;
    let totalCount = 0;

    for (const category of categories) {
      const ratio = coverage[category];
      
      this.ratio.set({ domain, behavior, category }, ratio);
      
      // For detailed metrics, we'd need actual counts
      // Using ratio as approximation
      totalPassed += ratio;
      totalCount += 1;
    }

    // Calculate overall coverage
    const overall = totalCount > 0 ? totalPassed / totalCount : 0;
    this.overall.set({ domain, behavior }, overall);
  }

  /**
   * Record detailed coverage (with actual counts)
   */
  recordDetailed(
    domain: string,
    behavior: string,
    category: CoverageCategory,
    passed: number,
    total: number
  ): void {
    const ratio = total > 0 ? passed / total : 0;
    
    this.ratio.set({ domain, behavior, category }, ratio);
    this.totalChecks.set({ domain, behavior, category }, total);
    this.passedChecks.set({ domain, behavior, category }, passed);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.ratio.reset();
    this.overall.reset();
    this.totalChecks.reset();
    this.passedChecks.reset();
  }
}
