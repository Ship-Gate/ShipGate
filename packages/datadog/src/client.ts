// ============================================================================
// Datadog Client
// ============================================================================

import type { StatsD } from 'hot-shots';
import type {
  DatadogConfig,
  VerifyResult,
  CheckResult,
  SLOMetric,
  LogEntry,
  SpanOptions,
  Span,
} from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Datadog ISL Client
 * 
 * Main client for interacting with Datadog services including:
 * - Metrics (via DogStatsD)
 * - Traces (via dd-trace)
 * - Logs (structured logging)
 * 
 * @example
 * ```typescript
 * const client = new DatadogClient({
 *   serviceName: 'my-service',
 *   env: 'production',
 * });
 * 
 * // Record verification
 * client.recordVerification({
 *   domain: 'auth',
 *   behavior: 'login',
 *   verdict: 'verified',
 *   score: 95,
 *   duration: 150,
 *   coverage: { preconditions: 1, postconditions: 0.9, invariants: 1 },
 * });
 * ```
 */
export class DatadogClient {
  private config: Required<DatadogConfig>;
  private statsd: StatsD | null = null;
  private tracer: unknown = null;
  private initialized = false;

  constructor(config: Partial<DatadogConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      apiKey: config.apiKey ?? process.env['DD_API_KEY'] ?? '',
      appKey: config.appKey ?? process.env['DD_APP_KEY'] ?? '',
      agentHost: config.agentHost ?? process.env['DD_AGENT_HOST'] ?? DEFAULT_CONFIG.agentHost,
      env: config.env ?? process.env['DD_ENV'] ?? DEFAULT_CONFIG.env,
    };
  }

  /**
   * Initialize the Datadog client
   * 
   * Lazily loads dd-trace and hot-shots to avoid initialization issues
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize StatsD client
      const { StatsD: StatsDClient } = await import('hot-shots');
      this.statsd = new StatsDClient({
        host: this.config.agentHost,
        port: this.config.statsdPort,
        prefix: this.config.metricPrefix,
        globalTags: {
          env: this.config.env,
          service: this.config.serviceName,
          version: this.config.version,
          ...this.config.globalTags,
        },
        errorHandler: (error) => {
          // Silently handle errors in production
          if (this.config.env === 'development') {
            console.error('[Datadog] StatsD error:', error.message);
          }
        },
      });

      // Initialize tracer (dd-trace)
      try {
        const ddTrace = await import('dd-trace');
        this.tracer = ddTrace.default;
        
        // Initialize tracer if not already initialized
        if (typeof (this.tracer as { init?: (config: unknown) => void }).init === 'function') {
          (this.tracer as { init: (config: unknown) => void }).init({
            service: this.config.serviceName,
            env: this.config.env,
            version: this.config.version,
            logInjection: this.config.logInjection,
            runtimeMetrics: this.config.runtimeMetrics,
            sampleRate: this.config.sampleRate,
          });
        }
      } catch {
        // dd-trace may not be installed, continue without tracing
        if (this.config.env === 'development') {
          console.warn('[Datadog] dd-trace not available, tracing disabled');
        }
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Datadog client: ${error}`);
    }
  }

  /**
   * Record a verification result
   */
  recordVerification(result: VerifyResult): void {
    if (!this.statsd) {
      this.warnNotInitialized('recordVerification');
      return;
    }

    const tags = this.buildTags(result);

    // Counters
    this.statsd.increment('verification.total', 1, tags);
    this.statsd.increment(`verification.${result.verdict}`, 1, tags);

    // Gauges
    this.statsd.gauge('verification.score', result.score, tags);
    this.statsd.gauge('verification.coverage.preconditions', result.coverage.preconditions * 100, tags);
    this.statsd.gauge('verification.coverage.postconditions', result.coverage.postconditions * 100, tags);
    this.statsd.gauge('verification.coverage.invariants', result.coverage.invariants * 100, tags);

    // Histograms for duration
    this.statsd.histogram('verification.duration', result.duration, tags);

    // Distribution for percentiles
    this.statsd.distribution('verification.latency', result.duration, tags);

    // Check count if provided
    if (result.checkCount !== undefined) {
      this.statsd.gauge('verification.check_count', result.checkCount, tags);
    }
  }

  /**
   * Record an individual check result
   */
  recordCheck(check: CheckResult): void {
    if (!this.statsd) {
      this.warnNotInitialized('recordCheck');
      return;
    }

    const tags = [
      `type:${check.type}`,
      `passed:${check.passed}`,
      `domain:${check.domain}`,
      `behavior:${check.behavior}`,
      ...this.flattenLabels(check.labels),
    ];

    this.statsd.increment('check.total', 1, tags);
    this.statsd.increment(`check.${check.passed ? 'passed' : 'failed'}`, 1, tags);
    this.statsd.histogram('check.duration', check.duration, tags);
  }

  /**
   * Record SLO metrics
   */
  recordSLO(slo: SLOMetric): void {
    if (!this.statsd) {
      this.warnNotInitialized('recordSLO');
      return;
    }

    const tags = [
      `slo:${slo.name}`,
      `domain:${slo.domain}`,
    ];

    this.statsd.gauge('slo.target', slo.target, tags);
    this.statsd.gauge('slo.current', slo.current, tags);
    this.statsd.gauge('slo.good_events', slo.goodEvents, tags);
    this.statsd.gauge('slo.total_events', slo.totalEvents, tags);
    this.statsd.gauge('slo.error_budget', Math.max(0, slo.target - slo.current), tags);
  }

  /**
   * Increment a custom counter
   */
  increment(metric: string, value = 1, tags?: string[]): void {
    if (!this.statsd) {
      this.warnNotInitialized('increment');
      return;
    }
    this.statsd.increment(metric, value, tags);
  }

  /**
   * Set a gauge value
   */
  gauge(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) {
      this.warnNotInitialized('gauge');
      return;
    }
    this.statsd.gauge(metric, value, tags);
  }

  /**
   * Record a histogram value
   */
  histogram(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) {
      this.warnNotInitialized('histogram');
      return;
    }
    this.statsd.histogram(metric, value, tags);
  }

  /**
   * Record a distribution value
   */
  distribution(metric: string, value: number, tags?: string[]): void {
    if (!this.statsd) {
      this.warnNotInitialized('distribution');
      return;
    }
    this.statsd.distribution(metric, value, tags);
  }

  /**
   * Create a new span for tracing
   */
  startSpan(options: SpanOptions): Span {
    const spanId = this.generateId();
    const traceId = options.parentContext?.traceId ?? this.generateId();
    
    const tags: Record<string, string | number | boolean> = {
      'isl.domain': options.domain,
      'isl.behavior': options.behavior,
      'resource.name': `${options.domain}.${options.behavior}`,
      ...options.tags,
    };

    if (options.operationType) {
      tags['isl.operation'] = options.operationType;
    }

    // If dd-trace is available, use it
    if (this.tracer && typeof (this.tracer as { startSpan?: (name: string, config: unknown) => unknown }).startSpan === 'function') {
      const ddSpan = (this.tracer as { startSpan: (name: string, config: unknown) => unknown }).startSpan('isl.behavior', { tags });
      return this.wrapDDSpan(ddSpan, traceId, spanId);
    }

    // Fallback mock span
    return this.createMockSpan(traceId, spanId, tags);
  }

  /**
   * Wrap a function with tracing
   */
  async traceBehavior<T>(
    domain: string,
    behavior: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.startSpan({ domain, behavior, operationType: 'execution' });
    
    try {
      const result = await fn();
      span.setTag('isl.success', true);
      return result;
    } catch (error) {
      span.setTag('isl.success', false);
      if (error instanceof Error) {
        span.setError(error);
      }
      throw error;
    } finally {
      span.finish();
    }
  }

  /**
   * Log a structured entry
   */
  log(entry: LogEntry): void {
    const logData = {
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp ?? new Date(),
      dd: {
        service: this.config.serviceName,
        env: this.config.env,
        version: this.config.version,
        trace_id: entry.traceId,
        span_id: entry.spanId,
      },
      isl: {
        domain: entry.domain,
        behavior: entry.behavior,
      },
      ...entry.attributes,
    };

    // Output as JSON for Datadog log ingestion
    const output = JSON.stringify(logData);
    
    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'critical':
        console.error(output);
        break;
    }
  }

  /**
   * Flush all pending metrics
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      if (this.statsd) {
        this.statsd.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    await this.flush();
    this.initialized = false;
    this.statsd = null;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<DatadogConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildTags(result: VerifyResult): string[] {
    return [
      `domain:${result.domain}`,
      `behavior:${result.behavior}`,
      `verdict:${result.verdict}`,
      ...this.flattenLabels(result.labels),
    ];
  }

  private flattenLabels(labels?: Record<string, string>): string[] {
    if (!labels) return [];
    return Object.entries(labels).map(([key, value]) => `${key}:${value}`);
  }

  private warnNotInitialized(method: string): void {
    if (this.config.env === 'development') {
      console.warn(`[Datadog] Client not initialized, ${method} will be skipped. Call initialize() first.`);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
  }

  private wrapDDSpan(ddSpan: unknown, traceId: string, spanId: string): Span {
    const span = ddSpan as {
      setTag: (key: string, value: unknown) => void;
      finish: () => void;
    };

    return {
      traceId,
      spanId,
      setTag: (key: string, value: string | number | boolean) => {
        span.setTag(key, value);
      },
      setError: (error: Error) => {
        span.setTag('error', true);
        span.setTag('error.message', error.message);
        span.setTag('error.stack', error.stack ?? '');
      },
      finish: () => {
        span.finish();
      },
    };
  }

  private createMockSpan(
    traceId: string,
    spanId: string,
    initialTags: Record<string, string | number | boolean>
  ): Span {
    const tags: Record<string, string | number | boolean> = { ...initialTags };

    return {
      traceId,
      spanId,
      setTag: (key: string, value: string | number | boolean) => {
        tags[key] = value;
      },
      setError: (error: Error) => {
        tags['error'] = true;
        tags['error.message'] = error.message;
      },
      finish: () => {
        // Mock span - no-op
      },
    };
  }
}

/**
 * Create a new Datadog client
 */
export function createDatadogClient(config?: Partial<DatadogConfig>): DatadogClient {
  return new DatadogClient(config);
}

/**
 * Create and initialize a Datadog client
 */
export async function createInitializedClient(config?: Partial<DatadogConfig>): Promise<DatadogClient> {
  const client = new DatadogClient(config);
  await client.initialize();
  return client;
}
