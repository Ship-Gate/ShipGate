import { MeterProvider } from '@opentelemetry/sdk-metrics';
import {
  Attributes,
  ObservableResult,
  ObservableGauge,
  Counter,
  Meter,
  metrics,
} from '@opentelemetry/api';

/**
 * Coverage data structure
 */
export interface CoverageData {
  domain: string;
  behavior?: string;
  preconditions: { total: number; covered: number };
  postconditions: { total: number; covered: number };
  invariants: { total: number; covered: number };
  behaviors?: { total: number; covered: number };
  edgeCases?: { total: number; covered: number };
}

/**
 * Coverage metrics collector
 */
export class CoverageMetrics {
  private meter: Meter;
  private coverageStore: Map<string, CoverageData> = new Map();

  // Gauges
  private preconditionCoverage: ObservableGauge;
  private postconditionCoverage: ObservableGauge;
  private invariantCoverage: ObservableGauge;
  private totalCoverage: ObservableGauge;
  private behaviorCoverage: ObservableGauge;
  private edgeCaseCoverage: ObservableGauge;

  // Counters
  private coverageUpdates: Counter;

  constructor(meterProvider?: MeterProvider) {
    if (meterProvider) {
      metrics.setGlobalMeterProvider(meterProvider);
    }
    this.meter = metrics.getMeter('isl-coverage-metrics', '1.0.0');

    // Precondition coverage gauge
    this.preconditionCoverage = this.meter.createObservableGauge(
      'isl_coverage_preconditions_percent',
      {
        description: 'Precondition coverage percentage',
        unit: '%',
      }
    );
    this.preconditionCoverage.addCallback((result) =>
      this.observeCoverage(result, 'preconditions')
    );

    // Postcondition coverage gauge
    this.postconditionCoverage = this.meter.createObservableGauge(
      'isl_coverage_postconditions_percent',
      {
        description: 'Postcondition coverage percentage',
        unit: '%',
      }
    );
    this.postconditionCoverage.addCallback((result) =>
      this.observeCoverage(result, 'postconditions')
    );

    // Invariant coverage gauge
    this.invariantCoverage = this.meter.createObservableGauge(
      'isl_coverage_invariants_percent',
      {
        description: 'Invariant coverage percentage',
        unit: '%',
      }
    );
    this.invariantCoverage.addCallback((result) =>
      this.observeCoverage(result, 'invariants')
    );

    // Total coverage gauge
    this.totalCoverage = this.meter.createObservableGauge(
      'isl_coverage_total_percent',
      {
        description: 'Total coverage percentage across all check types',
        unit: '%',
      }
    );
    this.totalCoverage.addCallback((result) => this.observeTotalCoverage(result));

    // Behavior coverage gauge
    this.behaviorCoverage = this.meter.createObservableGauge(
      'isl_coverage_behaviors_percent',
      {
        description: 'Behavior coverage percentage',
        unit: '%',
      }
    );
    this.behaviorCoverage.addCallback((result) =>
      this.observeCoverage(result, 'behaviors')
    );

    // Edge case coverage gauge
    this.edgeCaseCoverage = this.meter.createObservableGauge(
      'isl_coverage_edge_cases_percent',
      {
        description: 'Edge case coverage percentage',
        unit: '%',
      }
    );
    this.edgeCaseCoverage.addCallback((result) =>
      this.observeCoverage(result, 'edgeCases')
    );

    // Coverage update counter
    this.coverageUpdates = this.meter.createCounter('isl_coverage_updates_total', {
      description: 'Total number of coverage updates',
      unit: '1',
    });
  }

  /**
   * Update coverage data for a domain/behavior
   */
  updateCoverage(data: CoverageData): void {
    const key = data.behavior
      ? `${data.domain}:${data.behavior}`
      : data.domain;

    this.coverageStore.set(key, data);

    this.coverageUpdates.add(1, {
      domain: data.domain,
      behavior: data.behavior ?? 'all',
    });
  }

  /**
   * Get coverage data for a domain/behavior
   */
  getCoverage(domain: string, behavior?: string): CoverageData | undefined {
    const key = behavior ? `${domain}:${behavior}` : domain;
    return this.coverageStore.get(key);
  }

  /**
   * Calculate coverage percentage
   */
  private calculatePercentage(covered: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((covered / total) * 100 * 100) / 100;
  }

  /**
   * Observe coverage for a specific type
   */
  private observeCoverage(
    result: ObservableResult,
    type: 'preconditions' | 'postconditions' | 'invariants' | 'behaviors' | 'edgeCases'
  ): void {
    for (const [_key, data] of this.coverageStore) {
      const attributes: Attributes = {
        domain: data.domain,
        behavior: data.behavior ?? 'all',
      };

      const coverage = data[type];
      if (coverage) {
        const percentage = this.calculatePercentage(coverage.covered, coverage.total);
        result.observe(percentage, attributes);
      }
    }
  }

  /**
   * Observe total coverage
   */
  private observeTotalCoverage(result: ObservableResult): void {
    for (const [_key, data] of this.coverageStore) {
      const attributes: Attributes = {
        domain: data.domain,
        behavior: data.behavior ?? 'all',
      };

      const totalCovered =
        data.preconditions.covered +
        data.postconditions.covered +
        data.invariants.covered;

      const totalCount =
        data.preconditions.total +
        data.postconditions.total +
        data.invariants.total;

      const percentage = this.calculatePercentage(totalCovered, totalCount);
      result.observe(percentage, attributes);
    }
  }

  /**
   * Get aggregated coverage report
   */
  getReport(): CoverageReport {
    const domains: Map<string, AggregatedCoverage> = new Map();

    for (const [_key, data] of this.coverageStore) {
      const existing = domains.get(data.domain);

      if (existing) {
        existing.preconditions.total += data.preconditions.total;
        existing.preconditions.covered += data.preconditions.covered;
        existing.postconditions.total += data.postconditions.total;
        existing.postconditions.covered += data.postconditions.covered;
        existing.invariants.total += data.invariants.total;
        existing.invariants.covered += data.invariants.covered;
      } else {
        domains.set(data.domain, {
          domain: data.domain,
          preconditions: { ...data.preconditions },
          postconditions: { ...data.postconditions },
          invariants: { ...data.invariants },
        });
      }
    }

    const domainReports: DomainCoverageReport[] = [];
    let globalPre = { total: 0, covered: 0 };
    let globalPost = { total: 0, covered: 0 };
    let globalInv = { total: 0, covered: 0 };

    for (const [domain, data] of domains) {
      globalPre.total += data.preconditions.total;
      globalPre.covered += data.preconditions.covered;
      globalPost.total += data.postconditions.total;
      globalPost.covered += data.postconditions.covered;
      globalInv.total += data.invariants.total;
      globalInv.covered += data.invariants.covered;

      const totalCovered =
        data.preconditions.covered +
        data.postconditions.covered +
        data.invariants.covered;
      const totalCount =
        data.preconditions.total +
        data.postconditions.total +
        data.invariants.total;

      domainReports.push({
        domain,
        preconditions: this.calculatePercentage(
          data.preconditions.covered,
          data.preconditions.total
        ),
        postconditions: this.calculatePercentage(
          data.postconditions.covered,
          data.postconditions.total
        ),
        invariants: this.calculatePercentage(
          data.invariants.covered,
          data.invariants.total
        ),
        total: this.calculatePercentage(totalCovered, totalCount),
      });
    }

    const globalTotal =
      globalPre.total + globalPost.total + globalInv.total;
    const globalCovered =
      globalPre.covered + globalPost.covered + globalInv.covered;

    return {
      global: {
        preconditions: this.calculatePercentage(globalPre.covered, globalPre.total),
        postconditions: this.calculatePercentage(globalPost.covered, globalPost.total),
        invariants: this.calculatePercentage(globalInv.covered, globalInv.total),
        total: this.calculatePercentage(globalCovered, globalTotal),
      },
      domains: domainReports,
    };
  }

  /**
   * Clear all coverage data
   */
  clear(): void {
    this.coverageStore.clear();
  }
}

/**
 * Aggregated coverage data
 */
interface AggregatedCoverage {
  domain: string;
  preconditions: { total: number; covered: number };
  postconditions: { total: number; covered: number };
  invariants: { total: number; covered: number };
}

/**
 * Domain coverage report
 */
export interface DomainCoverageReport {
  domain: string;
  preconditions: number;
  postconditions: number;
  invariants: number;
  total: number;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  global: {
    preconditions: number;
    postconditions: number;
    invariants: number;
    total: number;
  };
  domains: DomainCoverageReport[];
}

/**
 * Create coverage metrics instance
 */
export function createCoverageMetrics(
  meterProvider?: MeterProvider
): CoverageMetrics {
  return new CoverageMetrics(meterProvider);
}
