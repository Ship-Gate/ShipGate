// ============================================================================
// Temporal Metrics - Track latency and timing
// ============================================================================

import { Histogram, Gauge, Summary, Registry } from 'prom-client';

/**
 * Temporal/latency metrics collection
 */
export class TemporalMetrics {
  /** Implementation latency histogram */
  readonly latency: Histogram<'domain' | 'behavior'>;
  
  /** P50 latency gauge */
  readonly p50Latency: Gauge<'domain' | 'behavior'>;
  
  /** P95 latency gauge */
  readonly p95Latency: Gauge<'domain' | 'behavior'>;
  
  /** P99 latency gauge */
  readonly p99Latency: Gauge<'domain' | 'behavior'>;
  
  /** Latency summary with quantiles */
  readonly latencySummary: Summary<'domain' | 'behavior'>;
  
  /** SLA compliance rate */
  readonly slaCompliance: Gauge<'domain' | 'behavior' | 'threshold'>;

  constructor(registry: Registry, prefix: string, latencyBuckets: number[]) {
    this.latency = new Histogram({
      name: `${prefix}implementation_latency_seconds`,
      help: 'Implementation response time in seconds',
      labelNames: ['domain', 'behavior'] as const,
      buckets: latencyBuckets,
      registers: [registry],
    });

    this.p50Latency = new Gauge({
      name: `${prefix}implementation_latency_p50_seconds`,
      help: 'P50 implementation latency in seconds',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.p95Latency = new Gauge({
      name: `${prefix}implementation_latency_p95_seconds`,
      help: 'P95 implementation latency in seconds',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.p99Latency = new Gauge({
      name: `${prefix}implementation_latency_p99_seconds`,
      help: 'P99 implementation latency in seconds',
      labelNames: ['domain', 'behavior'] as const,
      registers: [registry],
    });

    this.latencySummary = new Summary({
      name: `${prefix}implementation_latency_summary_seconds`,
      help: 'Implementation latency summary with quantiles',
      labelNames: ['domain', 'behavior'] as const,
      percentiles: [0.5, 0.9, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      registers: [registry],
    });

    this.slaCompliance = new Gauge({
      name: `${prefix}sla_compliance_rate`,
      help: 'SLA compliance rate for latency threshold',
      labelNames: ['domain', 'behavior', 'threshold'] as const,
      registers: [registry],
    });
  }

  // Track latencies for percentile calculation
  private latencies = new Map<string, number[]>();
  private readonly maxLatencySamples = 1000;

  /**
   * Record a latency measurement
   */
  record(domain: string, behavior: string, latency: number): void {
    // Record to histogram
    this.latency.observe({ domain, behavior }, latency);
    
    // Record to summary
    this.latencySummary.observe({ domain, behavior }, latency);
    
    // Track for percentile calculation
    this.trackLatency(domain, behavior, latency);
    
    // Update percentile gauges
    this.updatePercentiles(domain, behavior);
  }

  private trackLatency(domain: string, behavior: string, latency: number): void {
    const key = `${domain}:${behavior}`;
    
    if (!this.latencies.has(key)) {
      this.latencies.set(key, []);
    }
    
    const samples = this.latencies.get(key)!;
    samples.push(latency);
    
    // Keep only recent samples
    if (samples.length > this.maxLatencySamples) {
      samples.shift();
    }
  }

  private updatePercentiles(domain: string, behavior: string): void {
    const key = `${domain}:${behavior}`;
    const samples = this.latencies.get(key);
    
    if (!samples || samples.length === 0) return;
    
    const sorted = [...samples].sort((a, b) => a - b);
    
    const p50 = this.percentile(sorted, 0.5);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);
    
    this.p50Latency.set({ domain, behavior }, p50);
    this.p95Latency.set({ domain, behavior }, p95);
    this.p99Latency.set({ domain, behavior }, p99);
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Record SLA compliance
   */
  recordSlaCompliance(
    domain: string,
    behavior: string,
    threshold: number,
    compliant: number,
    total: number
  ): void {
    const rate = total > 0 ? compliant / total : 0;
    this.slaCompliance.set(
      { domain, behavior, threshold: `${threshold}s` },
      rate
    );
  }

  /**
   * Check latency against SLA threshold
   */
  checkSla(domain: string, behavior: string, threshold: number): number {
    const key = `${domain}:${behavior}`;
    const samples = this.latencies.get(key);
    
    if (!samples || samples.length === 0) return 1;
    
    const compliant = samples.filter(s => s <= threshold).length;
    return compliant / samples.length;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.latency.reset();
    this.p50Latency.reset();
    this.p95Latency.reset();
    this.p99Latency.reset();
    this.latencySummary.reset();
    this.slaCompliance.reset();
    this.latencies.clear();
  }
}
