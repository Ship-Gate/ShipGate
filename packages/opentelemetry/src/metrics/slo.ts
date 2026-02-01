import {
  MeterProvider,
  ObservableGauge,
  Counter,
  Histogram,
  Meter,
} from '@opentelemetry/sdk-metrics';
import { Attributes, ObservableResult } from '@opentelemetry/api';

/**
 * SLO (Service Level Objective) definition
 */
export interface SLODefinition {
  name: string;
  description?: string;
  target: number;
  type: 'availability' | 'latency' | 'error_rate' | 'verification_pass_rate';
  window: 'hourly' | 'daily' | 'weekly' | 'monthly';
  domain?: string;
}

/**
 * SLO measurement
 */
export interface SLOMeasurement {
  sloName: string;
  value: number;
  timestamp: number;
  attributes?: Attributes;
}

/**
 * SLO status
 */
export interface SLOStatus {
  name: string;
  target: number;
  current: number;
  met: boolean;
  budgetRemaining: number;
  budgetConsumed: number;
  window: string;
}

/**
 * SLO metrics collector for ISL verification
 */
export class SLOMetrics {
  private meter: Meter;
  private sloDefinitions: Map<string, SLODefinition> = new Map();
  private sloMeasurements: Map<string, SLOMeasurement[]> = new Map();

  // Gauges
  private sloCurrentValue: ObservableGauge;
  private sloBudgetRemaining: ObservableGauge;
  private sloMet: ObservableGauge;

  // Counters
  private sloViolations: Counter;
  private sloMeasurementCount: Counter;

  // Histograms
  private sloLatency: Histogram;

  constructor(meterProvider?: MeterProvider) {
    const provider = meterProvider ?? new MeterProvider();
    this.meter = provider.getMeter('isl-slo-metrics', '1.0.0');

    // SLO current value gauge
    this.sloCurrentValue = this.meter.createObservableGauge('isl_slo_current_value', {
      description: 'Current SLO value',
      unit: '%',
    });
    this.sloCurrentValue.addCallback((result) => this.observeCurrentValue(result));

    // SLO budget remaining gauge
    this.sloBudgetRemaining = this.meter.createObservableGauge(
      'isl_slo_budget_remaining',
      {
        description: 'Remaining error budget for SLO',
        unit: '%',
      }
    );
    this.sloBudgetRemaining.addCallback((result) =>
      this.observeBudgetRemaining(result)
    );

    // SLO met gauge (1 = met, 0 = not met)
    this.sloMet = this.meter.createObservableGauge('isl_slo_met', {
      description: 'Whether SLO is currently being met (1=yes, 0=no)',
      unit: '1',
    });
    this.sloMet.addCallback((result) => this.observeSloMet(result));

    // SLO violations counter
    this.sloViolations = this.meter.createCounter('isl_slo_violations_total', {
      description: 'Total number of SLO violations',
      unit: '1',
    });

    // SLO measurement counter
    this.sloMeasurementCount = this.meter.createCounter('isl_slo_measurements_total', {
      description: 'Total number of SLO measurements',
      unit: '1',
    });

    // SLO latency histogram (for latency-based SLOs)
    this.sloLatency = this.meter.createHistogram('isl_slo_latency_seconds', {
      description: 'Latency measurements for SLO tracking',
      unit: 's',
      advice: {
        explicitBucketBoundaries: [
          0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
        ],
      },
    });
  }

  /**
   * Register an SLO definition
   */
  registerSLO(definition: SLODefinition): void {
    this.sloDefinitions.set(definition.name, definition);
    this.sloMeasurements.set(definition.name, []);
  }

  /**
   * Record an SLO measurement
   */
  recordMeasurement(measurement: SLOMeasurement): void {
    const definition = this.sloDefinitions.get(measurement.sloName);
    if (!definition) {
      throw new Error(`SLO not found: ${measurement.sloName}`);
    }

    const measurements = this.sloMeasurements.get(measurement.sloName) ?? [];
    measurements.push({
      ...measurement,
      timestamp: measurement.timestamp ?? Date.now(),
    });

    // Keep only measurements within the window
    const windowMs = this.getWindowMs(definition.window);
    const cutoff = Date.now() - windowMs;
    const filtered = measurements.filter((m) => m.timestamp >= cutoff);
    this.sloMeasurements.set(measurement.sloName, filtered);

    // Update counters
    this.sloMeasurementCount.add(1, {
      slo_name: definition.name,
      slo_type: definition.type,
      domain: definition.domain ?? 'all',
    });

    // Check for violations
    const currentValue = this.calculateCurrentValue(measurement.sloName);
    if (currentValue < definition.target) {
      this.sloViolations.add(1, {
        slo_name: definition.name,
        slo_type: definition.type,
        domain: definition.domain ?? 'all',
      });
    }

    // Record latency if applicable
    if (definition.type === 'latency') {
      this.sloLatency.record(measurement.value / 1000, {
        slo_name: definition.name,
        domain: definition.domain ?? 'all',
      });
    }
  }

  /**
   * Get SLO status
   */
  getStatus(sloName: string): SLOStatus | undefined {
    const definition = this.sloDefinitions.get(sloName);
    if (!definition) return undefined;

    const currentValue = this.calculateCurrentValue(sloName);
    const budgetRemaining = Math.max(0, currentValue - definition.target);
    const budgetTotal = 100 - definition.target;
    const budgetConsumed =
      budgetTotal > 0 ? Math.max(0, budgetTotal - budgetRemaining) : 0;

    return {
      name: definition.name,
      target: definition.target,
      current: currentValue,
      met: currentValue >= definition.target,
      budgetRemaining,
      budgetConsumed,
      window: definition.window,
    };
  }

  /**
   * Get all SLO statuses
   */
  getAllStatuses(): SLOStatus[] {
    const statuses: SLOStatus[] = [];
    for (const [name] of this.sloDefinitions) {
      const status = this.getStatus(name);
      if (status) statuses.push(status);
    }
    return statuses;
  }

  /**
   * Calculate current SLO value
   */
  private calculateCurrentValue(sloName: string): number {
    const definition = this.sloDefinitions.get(sloName);
    const measurements = this.sloMeasurements.get(sloName);

    if (!definition || !measurements || measurements.length === 0) {
      return 100; // Default to 100% if no measurements
    }

    switch (definition.type) {
      case 'availability':
      case 'verification_pass_rate':
        // Average of all measurements
        const sum = measurements.reduce((acc, m) => acc + m.value, 0);
        return Math.round((sum / measurements.length) * 100) / 100;

      case 'latency':
        // Percentile calculation (P95 by default)
        const sorted = [...measurements].sort((a, b) => a.value - b.value);
        const p95Index = Math.floor(sorted.length * 0.95);
        return sorted[p95Index]?.value ?? 0;

      case 'error_rate':
        // Inverse - lower is better
        const errorSum = measurements.reduce((acc, m) => acc + m.value, 0);
        const errorRate = errorSum / measurements.length;
        return Math.round((100 - errorRate) * 100) / 100;

      default:
        return 0;
    }
  }

  /**
   * Get window duration in milliseconds
   */
  private getWindowMs(window: SLODefinition['window']): number {
    switch (window) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Observe current SLO values
   */
  private observeCurrentValue(result: ObservableResult): void {
    for (const [name, definition] of this.sloDefinitions) {
      const currentValue = this.calculateCurrentValue(name);
      result.observe(currentValue, {
        slo_name: name,
        slo_type: definition.type,
        domain: definition.domain ?? 'all',
        window: definition.window,
      });
    }
  }

  /**
   * Observe budget remaining
   */
  private observeBudgetRemaining(result: ObservableResult): void {
    for (const [name, definition] of this.sloDefinitions) {
      const currentValue = this.calculateCurrentValue(name);
      const budgetRemaining = Math.max(0, currentValue - definition.target);

      result.observe(budgetRemaining, {
        slo_name: name,
        slo_type: definition.type,
        domain: definition.domain ?? 'all',
        window: definition.window,
      });
    }
  }

  /**
   * Observe SLO met status
   */
  private observeSloMet(result: ObservableResult): void {
    for (const [name, definition] of this.sloDefinitions) {
      const currentValue = this.calculateCurrentValue(name);
      const met = currentValue >= definition.target ? 1 : 0;

      result.observe(met, {
        slo_name: name,
        slo_type: definition.type,
        domain: definition.domain ?? 'all',
        window: definition.window,
      });
    }
  }

  /**
   * Clear all SLO data
   */
  clear(): void {
    this.sloMeasurements.clear();
  }
}

/**
 * Create SLO metrics instance
 */
export function createSLOMetrics(meterProvider?: MeterProvider): SLOMetrics {
  return new SLOMetrics(meterProvider);
}

/**
 * Pre-defined SLO templates for ISL verification
 */
export const SLOTemplates = {
  /**
   * Verification pass rate SLO (99.9% target)
   */
  verificationPassRate: (domain: string): SLODefinition => ({
    name: `${domain}_verification_pass_rate`,
    description: `Verification pass rate for ${domain}`,
    target: 99.9,
    type: 'verification_pass_rate',
    window: 'daily',
    domain,
  }),

  /**
   * Verification latency SLO (P95 < 500ms)
   */
  verificationLatency: (domain: string): SLODefinition => ({
    name: `${domain}_verification_latency`,
    description: `Verification latency P95 for ${domain}`,
    target: 500, // ms
    type: 'latency',
    window: 'daily',
    domain,
  }),

  /**
   * Error rate SLO (< 0.1%)
   */
  errorRate: (domain: string): SLODefinition => ({
    name: `${domain}_error_rate`,
    description: `Error rate for ${domain}`,
    target: 99.9, // 100 - 0.1 = 99.9% success
    type: 'error_rate',
    window: 'daily',
    domain,
  }),

  /**
   * Availability SLO (99.99%)
   */
  availability: (domain: string): SLODefinition => ({
    name: `${domain}_availability`,
    description: `Availability for ${domain}`,
    target: 99.99,
    type: 'availability',
    window: 'monthly',
    domain,
  }),
};
