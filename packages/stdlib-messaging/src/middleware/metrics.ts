/**
 * Metrics middleware
 */

import type { Middleware, ProduceContext, ConsumeContext } from '../types.js';
import type { HandlerResult } from '../types.js';

// ============================================================================
// METRICS INTERFACE
// ============================================================================

export interface MetricsCollector {
  /**
   * Increment a counter
   */
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  
  /**
   * Record a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  
  /**
   * Record a timer
   */
  timer(name: string, duration: number, tags?: Record<string, string>): void;
}

// ============================================================================
// DEFAULT METRICS COLLECTOR
// ============================================================================

export class DefaultMetricsCollector implements MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private timers = new Map<string, number[]>();
  
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }
  
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.gauges.set(key, value);
  }
  
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }
  
  timer(name: string, duration: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    if (!this.timers.has(key)) {
      this.timers.set(key, []);
    }
    this.timers.get(key)!.push(duration);
  }
  
  /**
   * Get all metrics
   */
  getMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; min: number; max: number; avg: number }>;
    timers: Record<string, { count: number; sum: number; min: number; max: number; avg: number }>;
  } {
    const histograms: Record<string, any> = {};
    const timers: Record<string, any> = {};
    
    // Process histograms
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        histograms[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }
    
    // Process timers
    for (const [key, values] of this.timers) {
      if (values.length > 0) {
        timers[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }
    
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
      timers,
    };
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }
  
  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags) {
      return name;
    }
    
    const tagPairs = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    
    return `${name}{${tagPairs.join(',')}}`;
  }
}

// ============================================================================
// METRICS MIDDLEWARE
// ============================================================================

export interface MetricsOptions {
  /** Metrics collector */
  collector: MetricsCollector;
  
  /** Custom metrics names */
  metricNames?: {
    messagesProduced?: string;
    messagesConsumed?: string;
    messagesAcknowledged?: string;
    messagesRejected?: string;
    messagesDeadLettered?: string;
    produceLatency?: string;
    consumeLatency?: string;
    payloadSize?: string;
    queueDepth?: string;
  };
  
  /** Whether to track payload sizes */
  trackPayloadSize?: boolean;
  
  /** Whether to track queue depth */
  trackQueueDepth?: boolean;
  
  /** Default tags to apply to all metrics */
  defaultTags?: Record<string, string>;
}

export class MetricsMiddleware implements Middleware {
  readonly name = 'metrics';
  
  private readonly metricNames: Required<NonNullable<MetricsOptions['metricNames']>>;
  
  constructor(private readonly options: MetricsOptions) {
    this.metricNames = {
      messagesProduced: 'messaging.messages.produced',
      messagesConsumed: 'messaging.messages.consumed',
      messagesAcknowledged: 'messaging.messages.acknowledged',
      messagesRejected: 'messaging.messages.rejected',
      messagesDeadLettered: 'messaging.messages.dead_lettered',
      produceLatency: 'messaging.produce.latency',
      consumeLatency: 'messaging.consume.latency',
      payloadSize: 'messaging.payload.size',
      queueDepth: 'messaging.queue.depth',
      ...options.metricNames,
    };
  }
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    const payloadSize = this.getPayloadSize(context.message.payload);
    
    try {
      await next();
      
      // Record success metrics
      const duration = Date.now() - startTime;
      const tags = this.buildTags(context.queue, context.message);
      
      this.options.collector.increment(this.metricNames.messagesProduced, 1, tags);
      this.options.collector.timer(this.metricNames.produceLatency, duration, tags);
      
      if (this.options.trackPayloadSize) {
        this.options.collector.histogram(this.metricNames.payloadSize, payloadSize, tags);
      }
      
      if (this.options.trackQueueDepth) {
        // In a real implementation, this would query the queue depth
        // For now, we'll skip it
      }
    } catch (error) {
      // Record error metrics
      const duration = Date.now() - startTime;
      const tags = this.buildTags(context.queue, context.message, { error: 'true' });
      
      this.options.collector.increment(this.metricNames.messagesProduced, 1, tags);
      this.options.collector.timer(this.metricNames.produceLatency, duration, tags);
      
      throw error;
    }
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    const startTime = Date.now();
    const payloadSize = this.getPayloadSize(context.message.payload);
    
    try {
      const result = await next();
      
      // Record success metrics
      const duration = Date.now() - startTime;
      const tags = this.buildTags(context.queue, context.message, {
        result: result.toLowerCase(),
      });
      
      this.options.collector.increment(this.metricNames.messagesConsumed, 1, tags);
      this.options.collector.timer(this.metricNames.consumeLatency, duration, tags);
      
      if (this.options.trackPayloadSize) {
        this.options.collector.histogram(this.metricNames.payloadSize, payloadSize, tags);
      }
      
      // Record specific result metrics
      switch (result) {
        case 'ACK':
          this.options.collector.increment(this.metricNames.messagesAcknowledged, 1, tags);
          break;
        case 'NACK':
          this.options.collector.increment(this.metricNames.messagesRejected, 1, tags);
          break;
        case 'DEAD_LETTER':
          this.options.collector.increment(this.metricNames.messagesDeadLettered, 1, tags);
          break;
      }
      
      return result;
    } catch (error) {
      // Record error metrics
      const duration = Date.now() - startTime;
      const tags = this.buildTags(context.queue, context.message, { error: 'true' });
      
      this.options.collector.increment(this.metricNames.messagesConsumed, 1, tags);
      this.options.collector.timer(this.metricNames.consumeLatency, duration, tags);
      
      throw error;
    }
  }
  
  private buildTags(
    queue: string,
    message: any,
    additional?: Record<string, string>
  ): Record<string, string> {
    const tags: Record<string, string> = {
      queue,
      contentType: message.contentType || 'unknown',
      ...this.options.defaultTags,
      ...additional,
    };
    
    return tags;
  }
  
  private getPayloadSize(payload: any): number {
    try {
      return JSON.stringify(payload).length;
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// PROMETHEUS METRICS COLLECTOR
// ============================================================================

export class PrometheusMetricsCollector implements MetricsCollector {
  private metrics = new Map<string, { type: string; help: string; samples: string[] }>();
  
  constructor() {
    // Initialize default metrics
    this.createCounter('messaging_messages_produced_total', 'Total number of messages produced');
    this.createCounter('messaging_messages_consumed_total', 'Total number of messages consumed');
    this.createCounter('messaging_messages_acknowledged_total', 'Total number of messages acknowledged');
    this.createCounter('messaging_messages_rejected_total', 'Total number of messages rejected');
    this.createCounter('messaging_messages_dead_lettered_total', 'Total number of messages dead-lettered');
    this.createHistogram('messaging_produce_duration_seconds', 'Time spent producing messages');
    this.createHistogram('messaging_consume_duration_seconds', 'Time spent consuming messages');
    this.createHistogram('messaging_payload_size_bytes', 'Size of message payloads');
    this.createGauge('messaging_queue_depth', 'Current queue depth');
  }
  
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const metricName = this.sanitizeName(name);
    const labelStr = this.formatLabels(tags);
    
    if (!this.metrics.has(metricName)) {
      this.createCounter(metricName, `Counter for ${name}`);
    }
    
    const metric = this.metrics.get(metricName)!;
    const sample = `${metricName}${labelStr} ${value}`;
    
    // Find existing sample or add new one
    const existingIndex = metric.samples.findIndex(s => s.startsWith(metricName + labelStr));
    if (existingIndex >= 0) {
      const existing = metric.samples[existingIndex];
      const currentValue = parseFloat(existing.split(' ')[1]);
      metric.samples[existingIndex] = `${metricName}${labelStr} ${currentValue + value}`;
    } else {
      metric.samples.push(sample);
    }
  }
  
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const metricName = this.sanitizeName(name);
    const labelStr = this.formatLabels(tags);
    
    if (!this.metrics.has(metricName)) {
      this.createGauge(metricName, `Gauge for ${name}`);
    }
    
    const metric = this.metrics.get(metricName)!;
    const sample = `${metricName}${labelStr} ${value}`;
    
    // Find existing sample or add new one
    const existingIndex = metric.samples.findIndex(s => s.startsWith(metricName + labelStr));
    if (existingIndex >= 0) {
      metric.samples[existingIndex] = sample;
    } else {
      metric.samples.push(sample);
    }
  }
  
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const metricName = this.sanitizeName(name);
    const labelStr = this.formatLabels(tags);
    
    if (!this.metrics.has(metricName)) {
      this.createHistogram(metricName, `Histogram for ${name}`);
    }
    
    const metric = this.metrics.get(metricName)!;
    
    // Update buckets and count/sum
    const buckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    
    for (const bucket of buckets) {
      const bucketName = `${metricName}_bucket${labelStr}`;
      const bucketValue = value <= bucket ? 1 : 0;
      
      const existingIndex = metric.samples.findIndex(s => s.startsWith(bucketName + `{le="${bucket}"`));
      if (existingIndex >= 0) {
        const existing = metric.samples[existingIndex];
        const currentValue = parseFloat(existing.split(' ')[1]);
        metric.samples[existingIndex] = `${bucketName}{le="${bucket}"${labelStr.replace(/^\{|\}$/g, '')}} ${currentValue + bucketValue}`;
      } else {
        metric.samples.push(`${bucketName}{le="${bucket}"${labelStr.replace(/^\{|\}$/g, '')}} ${bucketValue}`);
      }
    }
    
    // Update count and sum
    const countName = `${metricName}_count${labelStr}`;
    const sumName = `${metricName}_sum${labelStr}`;
    
    const existingCountIndex = metric.samples.findIndex(s => s.startsWith(countName));
    if (existingCountIndex >= 0) {
      const existing = metric.samples[existingCountIndex];
      const currentValue = parseFloat(existing.split(' ')[1]);
      metric.samples[existingCountIndex] = `${countName} ${currentValue + 1}`;
    } else {
      metric.samples.push(`${countName} 1`);
    }
    
    const existingSumIndex = metric.samples.findIndex(s => s.startsWith(sumName));
    if (existingSumIndex >= 0) {
      const existing = metric.samples[existingSumIndex];
      const currentValue = parseFloat(existing.split(' ')[1]);
      metric.samples[existingSumIndex] = `${sumName} ${currentValue + value}`;
    } else {
      metric.samples.push(`${sumName} ${value}`);
    }
  }
  
  timer(name: string, duration: number, tags?: Record<string, string>): void {
    // Convert to seconds for Prometheus
    this.histogram(name, duration / 1000, tags);
  }
  
  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const output: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      output.push(`# HELP ${name} ${metric.help}`);
      output.push(`# TYPE ${name} ${metric.type}`);
      output.push(...metric.samples);
      output.push(''); // Empty line between metrics
    }
    
    return output.join('\n');
  }
  
  private createCounter(name: string, help: string): void {
    this.metrics.set(name, { type: 'counter', help, samples: [] });
  }
  
  private createGauge(name: string, help: string): void {
    this.metrics.set(name, { type: 'gauge', help, samples: [] });
  }
  
  private createHistogram(name: string, help: string): void {
    this.metrics.set(name, { type: 'histogram', help, samples: [] });
  }
  
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  private formatLabels(tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return '';
    }
    
    const pairs = Object.entries(tags)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .sort();
    
    return `{${pairs.join(',')}}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a metrics middleware with default collector
 */
export function createMetricsMiddleware(
  options?: Partial<MetricsOptions>
): MetricsMiddleware {
  const collector = new DefaultMetricsCollector();
  
  return new MetricsMiddleware({
    collector,
    trackPayloadSize: true,
    trackQueueDepth: false,
    ...options,
  });
}

/**
 * Create a metrics middleware with Prometheus collector
 */
export function createPrometheusMetricsMiddleware(
  options?: Omit<MetricsOptions, 'collector'>
): MetricsMiddleware {
  const collector = new PrometheusMetricsCollector();
  
  return new MetricsMiddleware({
    collector,
    trackPayloadSize: true,
    trackQueueDepth: false,
    ...options,
  });
}
