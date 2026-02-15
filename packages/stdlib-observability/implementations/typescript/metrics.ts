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

export { MetricType, MetricUnit };
export type { MetricSample, MetricExporter };

// ============================================================================
// Metric Storage
// ============================================================================

interface CounterData {
  value: number;
  labels?: Record<LabelName, LabelValue>;
}

interface GaugeData {
  value: number;
  labels?: Record<LabelName, LabelValue>;
}

interface HistogramData {
  sum: number;
  count: number;
  buckets: Map<number, number>;
  labels?: Record<LabelName, LabelValue>;
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

// ============================================================================
// Metric Handle Classes
// ============================================================================

export class CounterHandle {
  constructor(private readonly registry: MetricsRegistry, private readonly metricName: MetricName) {}
  async increment(valueOrLabels?: number | Record<string, string>, labels?: Record<string, string>): Promise<void> {
    let value = 1;
    let resolvedLabels = labels;
    if (typeof valueOrLabels === 'object') {
      resolvedLabels = valueOrLabels;
    } else if (typeof valueOrLabels === 'number') {
      value = valueOrLabels;
    }
    const result = this.registry.incrementCounter({ name: this.metricName, value, labels: resolvedLabels });
    if (!result.success) throw (result as { success: false; error: Error }).error;
  }
}

export class GaugeHandle {
  constructor(private readonly registry: MetricsRegistry, private readonly metricName: MetricName) {}
  async set(value: number, labels?: Record<string, string>): Promise<void> {
    const result = this.registry.setGauge({ name: this.metricName, value, labels });
    if (!result.success) throw (result as { success: false; error: Error }).error;
  }
  async increment(value = 1, labels?: Record<string, string>): Promise<void> {
    const result = this.registry.incrementGauge(this.metricName, value, labels);
    if (!result.success) throw (result as { success: false; error: Error }).error;
  }
  async decrement(value = 1, labels?: Record<string, string>): Promise<void> {
    const result = this.registry.decrementGauge(this.metricName, value, labels);
    if (!result.success) throw (result as { success: false; error: Error }).error;
  }
}

export class HistogramHandle {
  constructor(private readonly registry: MetricsRegistry, private readonly metricName: MetricName) {}
  async observe(value: number, labels?: Record<string, string>): Promise<void> {
    const result = this.registry.observeHistogram({ name: this.metricName, value, labels });
    if (!result.success) throw (result as { success: false; error: Error }).error;
  }
  async recordTiming(startTime: Date, endTime?: Date, labels?: Record<string, string>): Promise<{ durationMs: number }> {
    const end = endTime ?? new Date();
    const durationMs = end.getTime() - startTime.getTime();
    await this.observe(durationMs / 1000, labels);
    return { durationMs };
  }
}

export class SummaryHandle {
  constructor(
    private readonly registry: MetricsRegistry,
    private readonly metricName: MetricName,
    private readonly objectives: Map<number, number>,
    private readonly maxAge?: number
  ) {}
  async observe(value: number): Promise<void> {
    this.registry.observeSummary(this.metricName, value);
  }
}

export class MetricsRegistry {
  private readonly definitions: Map<MetricName, MetricDefinition> = new Map();
  private readonly counters: Map<MetricName, Map<string, CounterData>> = new Map();
  private readonly gauges: Map<MetricName, Map<string, GaugeData>> = new Map();
  private readonly histograms: Map<MetricName, Map<string, HistogramData>> = new Map();
  private readonly summaries: Map<MetricName, { values: number[]; objectives: Map<number, number> }> = new Map();
  private readonly handles: Map<MetricName, CounterHandle | GaugeHandle | HistogramHandle | SummaryHandle> = new Map();
  private readonly exporters: MetricExporter[];
  private readonly defaultBuckets: number[];

  constructor(
    configOrExporters?: { exporter?: MetricExporter; exporters?: MetricExporter[]; defaultBuckets?: number[] } | MetricExporter[],
    defaultBuckets: number[] = [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ]
  ) {
    if (Array.isArray(configOrExporters)) {
      this.exporters = configOrExporters;
    } else if (configOrExporters && typeof configOrExporters === 'object') {
      this.exporters = configOrExporters.exporters ?? (configOrExporters.exporter ? [configOrExporters.exporter] : []);
    } else {
      this.exporters = [];
    }
    this.defaultBuckets = defaultBuckets;
  }

  registerCounter(
    config: { name: MetricName; description: string; unit?: MetricUnit; labels?: LabelName[] }
  ): CounterHandle {
    if (this.definitions.has(config.name)) {
      throw new Error(`Metric "${config.name}" already registered`);
    }
    this.definitions.set(config.name, {
      name: config.name,
      type: MetricType.COUNTER,
      description: config.description,
      unit: config.unit,
      labels: config.labels,
    });
    this.counters.set(config.name, new Map());
    const handle = new CounterHandle(this, config.name);
    this.handles.set(config.name, handle);
    return handle;
  }

  registerGauge(
    config: { name: MetricName; description: string; unit?: MetricUnit; labels?: LabelName[] }
  ): GaugeHandle {
    if (this.definitions.has(config.name)) {
      throw new Error(`Metric "${config.name}" already registered`);
    }
    this.definitions.set(config.name, {
      name: config.name,
      type: MetricType.GAUGE,
      description: config.description,
      unit: config.unit,
      labels: config.labels,
    });
    this.gauges.set(config.name, new Map());
    const handle = new GaugeHandle(this, config.name);
    this.handles.set(config.name, handle);
    return handle;
  }

  registerHistogram(
    config: { name: MetricName; description: string; unit?: MetricUnit; labels?: LabelName[]; buckets?: number[] }
  ): HistogramHandle {
    if (this.definitions.has(config.name)) {
      throw new Error(`Metric "${config.name}" already registered`);
    }
    this.definitions.set(config.name, {
      name: config.name,
      type: MetricType.HISTOGRAM,
      description: config.description,
      unit: config.unit,
      labels: config.labels,
      buckets: config.buckets ?? this.defaultBuckets,
    });
    this.histograms.set(config.name, new Map());
    const handle = new HistogramHandle(this, config.name);
    this.handles.set(config.name, handle);
    return handle;
  }

  registerSummary(
    config: { name: MetricName; description: string; unit?: MetricUnit; labels?: LabelName[]; objectives: Map<number, number>; maxAge?: number }
  ): SummaryHandle {
    if (this.definitions.has(config.name)) {
      throw new Error(`Metric "${config.name}" already registered`);
    }
    this.definitions.set(config.name, {
      name: config.name,
      type: MetricType.SUMMARY,
      description: config.description,
      unit: config.unit,
      labels: config.labels,
    });
    this.summaries.set(config.name, { values: [], objectives: config.objectives });
    const handle = new SummaryHandle(this, config.name, config.objectives, config.maxAge);
    this.handles.set(config.name, handle);
    return handle;
  }

  getMetric(name: MetricName): CounterHandle | GaugeHandle | HistogramHandle | SummaryHandle | undefined {
    return this.handles.get(name);
  }

  getMetricNames(): MetricName[] {
    return Array.from(this.definitions.keys());
  }

  clear(): void {
    this.definitions.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.handles.clear();
  }

  // ==========================================================================
  // Counter Operations
  // ==========================================================================

  incrementCounter(input: CounterInput): Result<void> {
    try {
      const { name, value = 1 } = input;
      const labels = input.labels && Object.keys(input.labels).length > 0 ? input.labels : undefined;

      if (value < 0) {
        return failure(new Error('Counter value must be non-negative'));
      }

      let counterMap = this.counters.get(name);
      if (!counterMap) {
        // Auto-register if not exists
        this.registerCounter({ name, description: `Auto-registered counter: ${name}` });
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
      const { name, value } = input;
      const labels = input.labels && Object.keys(input.labels).length > 0 ? input.labels : undefined;

      let gaugeMap = this.gauges.get(name);
      if (!gaugeMap) {
        // Auto-register if not exists
        this.registerGauge({ name, description: `Auto-registered gauge: ${name}` });
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
      const { name, value } = input;
      const labels = input.labels && Object.keys(input.labels).length > 0 ? input.labels : undefined;

      let histogramMap = this.histograms.get(name);
      if (!histogramMap) {
        // Auto-register if not exists
        this.registerHistogram({ name, description: `Auto-registered histogram: ${name}` });
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
  // Summary Operations
  // ==========================================================================

  observeSummary(name: MetricName, value: number): void {
    const summaryData = this.summaries.get(name);
    if (summaryData) {
      summaryData.values.push(value);
    }
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

  async collect(): Promise<void> {
    const samples = this.collectSamples();
    await Promise.all(this.exporters.map((exporter) => exporter.export(samples)));
  }

  collectSamples(): MetricSample[] {
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

    // Collect histograms (but not summaries - handled separately)
    for (const [name, histogramMap] of this.histograms) {
      if (this.summaries.has(name)) continue;
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
          const leStr = Number.isInteger(bucket) ? bucket.toFixed(1) : String(bucket);
          samples.push({
            name: `${name}_bucket`,
            timestamp: now,
            value: count,
            labels: { ...(data.labels ?? {}), le: leStr },
          });
        }
        // +Inf bucket
        samples.push({
          name: `${name}_bucket`,
          timestamp: now,
          value: data.count,
          labels: { ...(data.labels ?? {}), le: '+Inf' },
        });
      }
    }

    // Collect summaries with real quantile calculation
    for (const [name, summaryData] of this.summaries) {
      const { values, objectives } = summaryData;
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);

      for (const [quantile] of objectives) {
        const idx = Math.ceil(quantile * count) - 1;
        const val = sorted[Math.max(0, Math.min(idx, count - 1))]!;
        samples.push({
          name,
          timestamp: now,
          value: val,
          labels: { quantile: String(quantile) },
        });
      }
      samples.push({ name: `${name}_count`, timestamp: now, value: count });
      samples.push({ name: `${name}_sum`, timestamp: now, value: sum });
    }
    return samples;
  }

  async export(): Promise<void> {
    const samples = this.collectSamples();
    await Promise.all(this.exporters.map((exporter) => exporter.export(samples)));
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
    for (const summary of this.summaries.values()) {
      summary.values.length = 0;
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
