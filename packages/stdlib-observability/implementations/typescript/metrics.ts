// ============================================================================
// Observability Standard Library - Metrics Implementation
// @isl-lang/stdlib-observability
// ============================================================================

/// <reference types="node" />

import {
  MetricName,
  LabelName,
  LabelValue,
  MetricType,
  MetricUnit,
  MetricDefinition,
  MetricSample,
  CounterInput,
  GaugeInput,
  HistogramInput,
  TimingInput,
  TimingOutput,
  MetricExporter,
  Result,
  success,
  failure,
} from './types';

// ============================================================================
// Metric Storage
// ============================================================================

interface CounterData {
  value: number;
  labels: Record<LabelName, LabelValue>;
}

interface GaugeData {
  value: number;
  labels: Record<LabelName, LabelValue>;
}

interface HistogramData {
  sum: number;
  count: number;
  buckets: Map<number, number>;
  labels: Record<LabelName, LabelValue>;
}

function labelsKey(labels?: Record<LabelName, LabelValue>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return '';
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

// ============================================================================
// Console Exporter (Default)
// ============================================================================

export class ConsoleMetricExporter implements MetricExporter {
  async export(samples: MetricSample[]): Promise<void> {
    for (const sample of samples) {
      const labelStr = sample.labels
        ? `{${Object.entries(sample.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : '';
      const output = `${sample.name}${labelStr} ${sample.value} ${sample.timestamp.getTime()}`;
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(output + '\n');
      }
    }
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

// ============================================================================
// In-Memory Exporter (Testing)
// ============================================================================

export class InMemoryMetricExporter implements MetricExporter {
  private samples: MetricSample[] = [];

  async export(samples: MetricSample[]): Promise<void> {
    this.samples.push(...samples);
  }

  async shutdown(): Promise<void> {
    this.samples = [];
  }

  getSamples(): MetricSample[] {
    return [...this.samples];
  }

  clear(): void {
    this.samples = [];
  }
}

// ============================================================================
// Metrics Registry
// ============================================================================

export class MetricsRegistry {
  private readonly definitions: Map<MetricName, MetricDefinition> = new Map();
  private readonly counters: Map<MetricName, Map<string, CounterData>> =
    new Map();
  private readonly gauges: Map<MetricName, Map<string, GaugeData>> = new Map();
  private readonly histograms: Map<MetricName, Map<string, HistogramData>> =
    new Map();
  private readonly exporters: MetricExporter[];
  private readonly defaultBuckets: number[];

  constructor(
    exporters: MetricExporter[] = [],
    defaultBuckets: number[] = [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ]
  ) {
    this.exporters = exporters;
    this.defaultBuckets = defaultBuckets;
  }

  // ==========================================================================
  // Metric Definition
  // ==========================================================================

  registerCounter(
    name: MetricName,
    description: string,
    options: { unit?: MetricUnit; labels?: LabelName[] } = {}
  ): void {
    this.definitions.set(name, {
      name,
      type: MetricType.COUNTER,
      description,
      unit: options.unit,
      labels: options.labels,
    });
    this.counters.set(name, new Map());
  }

  registerGauge(
    name: MetricName,
    description: string,
    options: { unit?: MetricUnit; labels?: LabelName[] } = {}
  ): void {
    this.definitions.set(name, {
      name,
      type: MetricType.GAUGE,
      description,
      unit: options.unit,
      labels: options.labels,
    });
    this.gauges.set(name, new Map());
  }

  registerHistogram(
    name: MetricName,
    description: string,
    options: {
      unit?: MetricUnit;
      labels?: LabelName[];
      buckets?: number[];
    } = {}
  ): void {
    this.definitions.set(name, {
      name,
      type: MetricType.HISTOGRAM,
      description,
      unit: options.unit,
      labels: options.labels,
      buckets: options.buckets ?? this.defaultBuckets,
    });
    this.histograms.set(name, new Map());
  }

  // ==========================================================================
  // Counter Operations
  // ==========================================================================

  incrementCounter(input: CounterInput): Result<void> {
    try {
      const { name, value = 1, labels = {} } = input;

      if (value < 0) {
        return failure(new Error('Counter value must be non-negative'));
      }

      let counterMap = this.counters.get(name);
      if (!counterMap) {
        // Auto-register if not exists
        this.registerCounter(name, `Auto-registered counter: ${name}`);
        counterMap = this.counters.get(name)!;
      }

      const key = labelsKey(labels);
      const existing = counterMap.get(key);

      if (existing) {
        existing.value += value;
      } else {
        counterMap.set(key, { value, labels });
      }

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  getCounter(
    name: MetricName,
    labels?: Record<LabelName, LabelValue>
  ): number | undefined {
    const counterMap = this.counters.get(name);
    if (!counterMap) return undefined;

    const key = labelsKey(labels);
    return counterMap.get(key)?.value;
  }

  // ==========================================================================
  // Gauge Operations
  // ==========================================================================

  setGauge(input: GaugeInput): Result<void> {
    try {
      const { name, value, labels = {} } = input;

      let gaugeMap = this.gauges.get(name);
      if (!gaugeMap) {
        // Auto-register if not exists
        this.registerGauge(name, `Auto-registered gauge: ${name}`);
        gaugeMap = this.gauges.get(name)!;
      }

      const key = labelsKey(labels);
      gaugeMap.set(key, { value, labels });

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  incrementGauge(
    name: MetricName,
    value: number = 1,
    labels?: Record<LabelName, LabelValue>
  ): Result<void> {
    const current = this.getGauge(name, labels) ?? 0;
    return this.setGauge({ name, value: current + value, labels });
  }

  decrementGauge(
    name: MetricName,
    value: number = 1,
    labels?: Record<LabelName, LabelValue>
  ): Result<void> {
    const current = this.getGauge(name, labels) ?? 0;
    return this.setGauge({ name, value: current - value, labels });
  }

  getGauge(
    name: MetricName,
    labels?: Record<LabelName, LabelValue>
  ): number | undefined {
    const gaugeMap = this.gauges.get(name);
    if (!gaugeMap) return undefined;

    const key = labelsKey(labels);
    return gaugeMap.get(key)?.value;
  }

  // ==========================================================================
  // Histogram Operations
  // ==========================================================================

  observeHistogram(input: HistogramInput): Result<void> {
    try {
      const { name, value, labels = {} } = input;

      let histogramMap = this.histograms.get(name);
      if (!histogramMap) {
        // Auto-register if not exists
        this.registerHistogram(name, `Auto-registered histogram: ${name}`);
        histogramMap = this.histograms.get(name)!;
      }

      const definition = this.definitions.get(name);
      const buckets = definition?.buckets ?? this.defaultBuckets;

      const key = labelsKey(labels);
      let existing = histogramMap.get(key);

      if (!existing) {
        existing = {
          sum: 0,
          count: 0,
          buckets: new Map(buckets.map((b) => [b, 0])),
          labels,
        };
        histogramMap.set(key, existing);
      }

      existing.sum += value;
      existing.count += 1;

      // Update bucket counts
      for (const bucket of buckets) {
        if (value <= bucket) {
          existing.buckets.set(bucket, (existing.buckets.get(bucket) ?? 0) + 1);
        }
      }

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  getHistogram(
    name: MetricName,
    labels?: Record<LabelName, LabelValue>
  ): HistogramData | undefined {
    const histogramMap = this.histograms.get(name);
    if (!histogramMap) return undefined;

    const key = labelsKey(labels);
    return histogramMap.get(key);
  }

  // ==========================================================================
  // Timing
  // ==========================================================================

  recordTiming(input: TimingInput): Result<TimingOutput> {
    try {
      const { name, startTime, endTime = new Date(), labels } = input;
      const durationMs = endTime.getTime() - startTime.getTime();

      // Record as histogram (in seconds for Prometheus compatibility)
      const result = this.observeHistogram({
        name,
        value: durationMs / 1000,
        labels,
      });

      if (!result.success) {
        return result as Result<TimingOutput>;
      }

      return success({ durationMs });
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ==========================================================================
  // Timer Helper
  // ==========================================================================

  startTimer(
    name: MetricName,
    labels?: Record<LabelName, LabelValue>
  ): () => Result<TimingOutput> {
    const startTime = new Date();
    return () => this.recordTiming({ name, startTime, labels });
  }

  // ==========================================================================
  // Collection & Export
  // ==========================================================================

  collect(): MetricSample[] {
    const samples: MetricSample[] = [];
    const now = new Date();

    // Collect counters
    for (const [name, counterMap] of this.counters) {
      for (const [, data] of counterMap) {
        samples.push({
          name,
          timestamp: now,
          value: data.value,
          labels: data.labels,
        });
      }
    }

    // Collect gauges
    for (const [name, gaugeMap] of this.gauges) {
      for (const [, data] of gaugeMap) {
        samples.push({
          name,
          timestamp: now,
          value: data.value,
          labels: data.labels,
        });
      }
    }

    // Collect histograms
    for (const [name, histogramMap] of this.histograms) {
      for (const [, data] of histogramMap) {
        // Sum
        samples.push({
          name: `${name}_sum`,
          timestamp: now,
          value: data.sum,
          labels: data.labels,
        });
        // Count
        samples.push({
          name: `${name}_count`,
          timestamp: now,
          value: data.count,
          labels: data.labels,
        });
        // Buckets
        for (const [bucket, count] of data.buckets) {
          samples.push({
            name: `${name}_bucket`,
            timestamp: now,
            value: count,
            labels: { ...data.labels, le: String(bucket) },
          });
        }
        // +Inf bucket
        samples.push({
          name: `${name}_bucket`,
          timestamp: now,
          value: data.count,
          labels: { ...data.labels, le: '+Inf' },
        });
      }
    }

    return samples;
  }

  async export(): Promise<void> {
    const samples = this.collect();
    await Promise.all(
      this.exporters.map((exporter) => exporter.export(samples))
    );
  }

  async shutdown(): Promise<void> {
    await this.export();
    await Promise.all(this.exporters.map((exporter) => exporter.shutdown()));
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  reset(): void {
    for (const counterMap of this.counters.values()) {
      counterMap.clear();
    }
    for (const gaugeMap of this.gauges.values()) {
      gaugeMap.clear();
    }
    for (const histogramMap of this.histograms.values()) {
      histogramMap.clear();
    }
  }
}

// ============================================================================
// Default Registry
// ============================================================================

let defaultRegistry: MetricsRegistry | null = null;

export function getDefaultRegistry(): MetricsRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new MetricsRegistry();
  }
  return defaultRegistry;
}

export function setDefaultRegistry(registry: MetricsRegistry): void {
  defaultRegistry = registry;
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  MetricsRegistry,
  ConsoleMetricExporter,
  InMemoryMetricExporter,
  getDefaultRegistry,
  setDefaultRegistry,
};
