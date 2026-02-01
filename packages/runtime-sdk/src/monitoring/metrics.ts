/**
 * ISL Metrics
 * 
 * Runtime metrics collection for ISL verification.
 */

import type { Violation, ViolationType } from '../types.js';

export interface MonitorOptions {
  /** Path to ISL spec files (glob pattern) */
  spec: string;
  /** Metrics configuration */
  metrics?: {
    provider: 'prometheus' | 'statsd' | 'custom';
    prefix?: string;
    customCollector?: MetricsCollector;
  };
  /** Tracing configuration */
  traces?: {
    provider: 'opentelemetry' | 'jaeger' | 'custom';
  };
  /** Alert configuration */
  alerts?: {
    provider: 'pagerduty' | 'opsgenie' | 'slack' | 'custom';
    rules: AlertRule[];
  };
  /** Enable debug logging */
  debug?: boolean;
}

export interface AlertRule {
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  message?: string;
  channels?: string[];
}

export interface MetricsCollector {
  increment(name: string, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
}

export interface MonitorStats {
  preconditions: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  postconditions: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  invariants: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  byBehavior: Map<string, BehaviorStats>;
}

export interface BehaviorStats {
  behavior: string;
  preconditions: { passed: number; failed: number };
  postconditions: { passed: number; failed: number };
  latencies: number[];
}

/**
 * ISL Monitor for runtime metrics
 * 
 * @example
 * ```typescript
 * const monitor = new ISLMonitor({
 *   spec: './domains/*.isl',
 *   metrics: {
 *     provider: 'prometheus',
 *     prefix: 'isl_',
 *   },
 * });
 * 
 * monitor.start();
 * const stats = monitor.getStats();
 * ```
 */
export class ISLMonitor {
  private options: MonitorOptions;
  private collector: MetricsCollector;
  private stats: MonitorStats;
  private running = false;
  private violationHandlers: Array<(violation: Violation) => void> = [];

  constructor(options: MonitorOptions) {
    this.options = options;
    this.collector = options.metrics?.customCollector ?? createDefaultCollector(options.metrics?.prefix ?? 'isl_');
    this.stats = this.initStats();
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    
    if (this.options.debug) {
      console.log('[ISL Monitor] Started');
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.running = false;
    
    if (this.options.debug) {
      console.log('[ISL Monitor] Stopped');
    }
  }

  /**
   * Record a verification check
   */
  recordCheck(
    type: ViolationType,
    domain: string,
    behavior: string,
    passed: boolean,
    duration?: number
  ): void {
    if (!this.running) return;

    const labels = { domain, behavior, result: passed ? 'pass' : 'fail' };

    switch (type) {
      case 'precondition':
        this.collector.increment('precondition_checks_total', labels);
        this.stats.preconditions.total++;
        if (passed) {
          this.stats.preconditions.passed++;
        } else {
          this.stats.preconditions.failed++;
        }
        break;
      
      case 'postcondition':
        this.collector.increment('postcondition_checks_total', labels);
        this.stats.postconditions.total++;
        if (passed) {
          this.stats.postconditions.passed++;
        } else {
          this.stats.postconditions.failed++;
        }
        break;
      
      case 'invariant':
        this.collector.increment('invariant_checks_total', labels);
        this.stats.invariants.total++;
        if (passed) {
          this.stats.invariants.passed++;
        } else {
          this.stats.invariants.failed++;
        }
        break;
    }

    // Record latency
    if (duration !== undefined) {
      this.collector.histogram('verification_duration_seconds', duration / 1000, { domain, behavior });
      this.recordLatency(behavior, duration);
    }

    // Update behavior stats
    this.updateBehaviorStats(behavior, type, passed, duration);

    // Update pass rates
    this.updatePassRates();
  }

  /**
   * Record a violation
   */
  recordViolation(violation: Violation): void {
    if (!this.running) return;

    this.collector.increment('violations_total', {
      domain: violation.domain,
      behavior: violation.behavior,
      type: violation.type,
    });

    // Notify handlers
    for (const handler of this.violationHandlers) {
      try {
        handler(violation);
      } catch (error) {
        if (this.options.debug) {
          console.error('[ISL Monitor] Violation handler error:', error);
        }
      }
    }

    // Check alert rules
    this.checkAlerts(violation);
  }

  /**
   * Register a violation handler
   */
  onViolation(handler: (violation: Violation) => void): void {
    this.violationHandlers.push(handler);
  }

  /**
   * Get current stats
   */
  getStats(): MonitorStats {
    return { ...this.stats };
  }

  /**
   * Get Prometheus metrics format
   */
  getPrometheusMetrics(): string {
    const prefix = this.options.metrics?.prefix ?? 'isl_';
    const lines: string[] = [];

    // Precondition metrics
    lines.push(`# HELP ${prefix}precondition_checks_total Total precondition checks`);
    lines.push(`# TYPE ${prefix}precondition_checks_total counter`);
    lines.push(`${prefix}precondition_checks_total{result="pass"} ${this.stats.preconditions.passed}`);
    lines.push(`${prefix}precondition_checks_total{result="fail"} ${this.stats.preconditions.failed}`);

    // Postcondition metrics
    lines.push(`# HELP ${prefix}postcondition_checks_total Total postcondition checks`);
    lines.push(`# TYPE ${prefix}postcondition_checks_total counter`);
    lines.push(`${prefix}postcondition_checks_total{result="pass"} ${this.stats.postconditions.passed}`);
    lines.push(`${prefix}postcondition_checks_total{result="fail"} ${this.stats.postconditions.failed}`);

    // Invariant metrics
    lines.push(`# HELP ${prefix}invariant_checks_total Total invariant checks`);
    lines.push(`# TYPE ${prefix}invariant_checks_total counter`);
    lines.push(`${prefix}invariant_checks_total{result="pass"} ${this.stats.invariants.passed}`);
    lines.push(`${prefix}invariant_checks_total{result="fail"} ${this.stats.invariants.failed}`);

    // Latency percentiles
    lines.push(`# HELP ${prefix}verification_duration_seconds Verification duration`);
    lines.push(`# TYPE ${prefix}verification_duration_seconds histogram`);
    lines.push(`${prefix}verification_duration_seconds{quantile="0.5"} ${this.stats.latency.p50 / 1000}`);
    lines.push(`${prefix}verification_duration_seconds{quantile="0.95"} ${this.stats.latency.p95 / 1000}`);
    lines.push(`${prefix}verification_duration_seconds{quantile="0.99"} ${this.stats.latency.p99 / 1000}`);

    return lines.join('\n');
  }

  private initStats(): MonitorStats {
    return {
      preconditions: { total: 0, passed: 0, failed: 0, passRate: 1.0 },
      postconditions: { total: 0, passed: 0, failed: 0, passRate: 1.0 },
      invariants: { total: 0, passed: 0, failed: 0, passRate: 1.0 },
      latency: { p50: 0, p95: 0, p99: 0 },
      byBehavior: new Map(),
    };
  }

  private allLatencies: number[] = [];

  private recordLatency(behavior: string, duration: number): void {
    this.allLatencies.push(duration);
    
    // Keep only last 10000 latencies
    if (this.allLatencies.length > 10000) {
      this.allLatencies = this.allLatencies.slice(-10000);
    }

    // Update percentiles
    const sorted = [...this.allLatencies].sort((a, b) => a - b);
    this.stats.latency.p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    this.stats.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    this.stats.latency.p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  }

  private updateBehaviorStats(
    behavior: string,
    type: ViolationType,
    passed: boolean,
    duration?: number
  ): void {
    let stats = this.stats.byBehavior.get(behavior);
    if (!stats) {
      stats = {
        behavior,
        preconditions: { passed: 0, failed: 0 },
        postconditions: { passed: 0, failed: 0 },
        latencies: [],
      };
      this.stats.byBehavior.set(behavior, stats);
    }

    if (type === 'precondition') {
      if (passed) stats.preconditions.passed++;
      else stats.preconditions.failed++;
    } else if (type === 'postcondition') {
      if (passed) stats.postconditions.passed++;
      else stats.postconditions.failed++;
    }

    if (duration !== undefined) {
      stats.latencies.push(duration);
      if (stats.latencies.length > 1000) {
        stats.latencies = stats.latencies.slice(-1000);
      }
    }
  }

  private updatePassRates(): void {
    if (this.stats.preconditions.total > 0) {
      this.stats.preconditions.passRate = 
        this.stats.preconditions.passed / this.stats.preconditions.total;
    }
    if (this.stats.postconditions.total > 0) {
      this.stats.postconditions.passRate = 
        this.stats.postconditions.passed / this.stats.postconditions.total;
    }
    if (this.stats.invariants.total > 0) {
      this.stats.invariants.passRate = 
        this.stats.invariants.passed / this.stats.invariants.total;
    }
  }

  private checkAlerts(violation: Violation): void {
    const rules = this.options.alerts?.rules ?? [];
    
    for (const rule of rules) {
      // Simple condition parsing
      if (this.evaluateCondition(rule.condition)) {
        if (this.options.debug) {
          console.log(`[ISL Monitor] Alert triggered: ${rule.condition} (${rule.severity})`);
        }
        // In a real implementation, send to alert provider
      }
    }
  }

  private evaluateCondition(condition: string): boolean {
    // Parse simple conditions like "precondition_failure_rate > 0.01"
    const match = condition.match(/(\w+)_failure_rate\s*([<>]=?|==)\s*([\d.]+)/);
    if (!match) return false;

    const [, type, op, thresholdStr] = match;
    const threshold = parseFloat(thresholdStr!);
    
    let failureRate = 0;
    switch (type) {
      case 'precondition':
        failureRate = 1 - this.stats.preconditions.passRate;
        break;
      case 'postcondition':
        failureRate = 1 - this.stats.postconditions.passRate;
        break;
      case 'invariant':
        failureRate = 1 - this.stats.invariants.passRate;
        break;
    }

    switch (op) {
      case '>': return failureRate > threshold;
      case '>=': return failureRate >= threshold;
      case '<': return failureRate < threshold;
      case '<=': return failureRate <= threshold;
      case '==': return failureRate === threshold;
      default: return false;
    }
  }
}

/**
 * Create a default in-memory metrics collector
 */
function createDefaultCollector(prefix: string): MetricsCollector {
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  const histograms = new Map<string, number[]>();

  return {
    increment(name: string, labels?: Record<string, string>): void {
      const key = `${prefix}${name}${JSON.stringify(labels ?? {})}`;
      counters.set(key, (counters.get(key) ?? 0) + 1);
    },

    gauge(name: string, value: number, labels?: Record<string, string>): void {
      const key = `${prefix}${name}${JSON.stringify(labels ?? {})}`;
      gauges.set(key, value);
    },

    histogram(name: string, value: number, labels?: Record<string, string>): void {
      const key = `${prefix}${name}${JSON.stringify(labels ?? {})}`;
      const values = histograms.get(key) ?? [];
      values.push(value);
      histograms.set(key, values);
    },
  };
}
