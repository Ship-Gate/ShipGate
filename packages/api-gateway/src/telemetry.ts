/**
 * Telemetry
 * 
 * Metrics and observability for the gateway.
 */

export interface TelemetryConfig {
  /** Enable metrics collection */
  enabled?: boolean;
  /** Metrics prefix */
  prefix?: string;
  /** Export interval (ms) */
  exportInterval?: number;
  /** Custom labels */
  labels?: Record<string, string>;
  /** Histogram buckets for latency */
  latencyBuckets?: number[];
}

export interface RequestMetrics {
  /** Total requests */
  total: number;
  /** Successful requests */
  success: number;
  /** Failed requests */
  failed: number;
  /** Rate limited requests */
  rateLimited: number;
  /** Policy denied requests */
  policyDenied: number;
  /** Validation failed requests */
  validationFailed: number;
  /** Circuit breaker opened */
  circuitOpen: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** P99 latency (ms) */
  p99Latency: number;
}

interface ActiveRequest {
  id: string;
  startTime: number;
  domain?: string;
  behavior?: string;
}

/**
 * Telemetry collector
 */
export class Telemetry {
  private config: Required<TelemetryConfig>;
  private running = false;
  private activeRequests = new Map<string, ActiveRequest>();
  private latencies: number[] = [];
  private counters = {
    total: 0,
    success: 0,
    failed: 0,
    rateLimited: 0,
    policyDenied: 0,
    validationFailed: 0,
    circuitOpen: 0,
    postconditionFailed: 0,
  };
  private domainCounters = new Map<string, typeof this.counters>();
  private exportTimer?: ReturnType<typeof setInterval>;

  constructor(config?: TelemetryConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      prefix: config?.prefix ?? 'isl_gateway',
      exportInterval: config?.exportInterval ?? 60000,
      labels: config?.labels ?? {},
      latencyBuckets: config?.latencyBuckets ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    };
  }

  /**
   * Start telemetry collection
   */
  start(): void {
    if (!this.config.enabled) return;

    this.running = true;

    // Start export timer
    this.exportTimer = setInterval(() => {
      this.export();
    }, this.config.exportInterval);
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    this.running = false;

    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = undefined;
    }
  }

  /**
   * Start tracking a request
   */
  startRequest(
    requestId: string,
    request: { path: string; method: string }
  ): void {
    if (!this.running) return;

    this.activeRequests.set(requestId, {
      id: requestId,
      startTime: Date.now(),
    });

    this.counters.total++;
  }

  /**
   * Complete request tracking
   */
  completeRequest(requestId: string, statusCode: number): void {
    if (!this.running) return;

    const request = this.activeRequests.get(requestId);
    if (!request) return;

    const latency = Date.now() - request.startTime;
    this.latencies.push(latency);

    // Keep last 10000 latencies for percentile calculation
    if (this.latencies.length > 10000) {
      this.latencies.shift();
    }

    if (statusCode >= 200 && statusCode < 400) {
      this.counters.success++;
    } else {
      this.counters.failed++;
    }

    this.activeRequests.delete(requestId);
  }

  /**
   * Record rate limited request
   */
  recordRateLimited(requestId: string): void {
    if (!this.running) return;
    this.counters.rateLimited++;
    this.counters.failed++;
    this.activeRequests.delete(requestId);
  }

  /**
   * Record policy denied request
   */
  recordPolicyDenied(requestId: string, reason?: string): void {
    if (!this.running) return;
    this.counters.policyDenied++;
    this.counters.failed++;
    this.activeRequests.delete(requestId);
  }

  /**
   * Record validation failed request
   */
  recordValidationFailed(requestId: string, result: unknown): void {
    if (!this.running) return;
    this.counters.validationFailed++;
    this.counters.failed++;
    this.activeRequests.delete(requestId);
  }

  /**
   * Record circuit open
   */
  recordCircuitOpen(requestId: string, circuitName: string): void {
    if (!this.running) return;
    this.counters.circuitOpen++;
    this.counters.failed++;
    this.activeRequests.delete(requestId);
  }

  /**
   * Record postcondition failure
   */
  recordPostconditionFailed(requestId: string, result: unknown): void {
    if (!this.running) return;
    this.counters.postconditionFailed++;
  }

  /**
   * Record error
   */
  recordError(requestId: string, error: unknown): void {
    if (!this.running) return;
    this.counters.failed++;
    this.activeRequests.delete(requestId);
  }

  /**
   * Get current metrics
   */
  getMetrics(): Record<string, number> {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    return {
      [`${this.config.prefix}_requests_total`]: this.counters.total,
      [`${this.config.prefix}_requests_success`]: this.counters.success,
      [`${this.config.prefix}_requests_failed`]: this.counters.failed,
      [`${this.config.prefix}_requests_rate_limited`]: this.counters.rateLimited,
      [`${this.config.prefix}_requests_policy_denied`]: this.counters.policyDenied,
      [`${this.config.prefix}_requests_validation_failed`]: this.counters.validationFailed,
      [`${this.config.prefix}_requests_circuit_open`]: this.counters.circuitOpen,
      [`${this.config.prefix}_latency_avg_ms`]: this.calculateAverage(sortedLatencies),
      [`${this.config.prefix}_latency_p95_ms`]: sortedLatencies[p95Index] ?? 0,
      [`${this.config.prefix}_latency_p99_ms`]: sortedLatencies[p99Index] ?? 0,
      [`${this.config.prefix}_active_requests`]: this.activeRequests.size,
    };
  }

  /**
   * Get request metrics
   */
  getRequestMetrics(): RequestMetrics {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    return {
      total: this.counters.total,
      success: this.counters.success,
      failed: this.counters.failed,
      rateLimited: this.counters.rateLimited,
      policyDenied: this.counters.policyDenied,
      validationFailed: this.counters.validationFailed,
      circuitOpen: this.counters.circuitOpen,
      avgLatency: this.calculateAverage(sortedLatencies),
      p95Latency: sortedLatencies[p95Index] ?? 0,
      p99Latency: sortedLatencies[p99Index] ?? 0,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    const metrics = this.getMetrics();
    const labels = Object.entries(this.config.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    for (const [name, value] of Object.entries(metrics)) {
      const labelStr = labels ? `{${labels}}` : '';
      lines.push(`${name}${labelStr} ${value}`);
    }

    return lines.join('\n');
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  /**
   * Export metrics (placeholder for external systems)
   */
  private export(): void {
    // In production, this would export to Prometheus, DataDog, etc.
    // For now, we just log
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.counters = {
      total: 0,
      success: 0,
      failed: 0,
      rateLimited: 0,
      policyDenied: 0,
      validationFailed: 0,
      circuitOpen: 0,
      postconditionFailed: 0,
    };
    this.latencies = [];
    this.domainCounters.clear();
  }
}
