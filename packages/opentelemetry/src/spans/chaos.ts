import {
  trace,
  Span,
  SpanKind,
  SpanStatusCode,
  Attributes,
  context,
  Context,
} from '@opentelemetry/api';
import { ISLSemanticAttributes, ChaosInjectionType } from '../semantic-attributes.js';

/**
 * Configuration for chaos span
 */
export interface ChaosSpanConfig {
  injectionType: ChaosInjectionType;
  target: string;
  duration?: number;
  intensity?: number;
  attributes?: Attributes;
}

/**
 * Chaos injection result
 */
export interface ChaosResult {
  injectionType: ChaosInjectionType;
  target: string;
  recovered: boolean;
  recoveryTime?: number;
  systemBehavior: 'normal' | 'degraded' | 'failed';
  duration: number;
}

/**
 * Creates a chaos span for tracing chaos engineering experiments
 */
export class ChaosSpan {
  private span: Span;
  private startTime: number;
  private config: ChaosSpanConfig;
  private recoveryStartTime?: number;

  constructor(config: ChaosSpanConfig, parentContext?: Context) {
    this.config = config;
    this.startTime = Date.now();

    const tracer = trace.getTracer('isl-verification', '1.0.0');

    this.span = tracer.startSpan(
      `isl.chaos.${config.injectionType}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ISLSemanticAttributes.ISL_CHAOS_INJECTION_TYPE]: config.injectionType,
          [ISLSemanticAttributes.ISL_CHAOS_TARGET]: config.target,
          ...(config.duration && {
            [ISLSemanticAttributes.ISL_CHAOS_DURATION_MS]: config.duration,
          }),
          ...(config.intensity !== undefined && {
            [ISLSemanticAttributes.ISL_CHAOS_INTENSITY]: config.intensity,
          }),
          ...config.attributes,
        },
      },
      parentContext
    );
  }

  /**
   * Get the underlying span
   */
  getSpan(): Span {
    return this.span;
  }

  /**
   * Record the start of chaos injection
   */
  startInjection(): void {
    this.span.addEvent('chaos.injection.start', {
      timestamp: Date.now(),
    });
  }

  /**
   * Record the end of chaos injection
   */
  endInjection(): void {
    this.span.addEvent('chaos.injection.end', {
      timestamp: Date.now(),
      duration_ms: Date.now() - this.startTime,
    });
    this.recoveryStartTime = Date.now();
  }

  /**
   * Record a chaos event
   */
  recordEvent(name: string, attributes?: Attributes): void {
    this.span.addEvent(`chaos.${name}`, attributes);
  }

  /**
   * Record system degradation
   */
  recordDegradation(description: string, severity: 'low' | 'medium' | 'high'): void {
    this.span.addEvent('chaos.degradation', {
      description,
      severity,
      timestamp: Date.now(),
    });
  }

  /**
   * Record error injection result
   */
  recordErrorInjection(errorType: string, errorMessage: string, handled: boolean): void {
    this.span.addEvent('chaos.error_injection', {
      error_type: errorType,
      error_message: errorMessage,
      handled,
      timestamp: Date.now(),
    });
  }

  /**
   * Record latency injection result
   */
  recordLatencyInjection(injectedLatency: number, actualLatency: number): void {
    this.span.addEvent('chaos.latency_injection', {
      injected_latency_ms: injectedLatency,
      actual_latency_ms: actualLatency,
      timestamp: Date.now(),
    });
  }

  /**
   * Record resource exhaustion
   */
  recordResourceExhaustion(
    resource: string,
    usage: number,
    limit: number
  ): void {
    this.span.addEvent('chaos.resource_exhaustion', {
      resource,
      usage,
      limit,
      usage_percent: Math.round((usage / limit) * 100),
      timestamp: Date.now(),
    });
  }

  /**
   * Record network partition
   */
  recordPartition(partitionedNodes: string[]): void {
    this.span.addEvent('chaos.partition', {
      partitioned_nodes: partitionedNodes.join(','),
      node_count: partitionedNodes.length,
      timestamp: Date.now(),
    });
  }

  /**
   * Complete the chaos span with recovery status
   */
  complete(
    recovered: boolean,
    systemBehavior: 'normal' | 'degraded' | 'failed' = 'normal'
  ): ChaosResult {
    const duration = Date.now() - this.startTime;
    const recoveryTime = this.recoveryStartTime
      ? Date.now() - this.recoveryStartTime
      : undefined;

    this.span.setAttribute(ISLSemanticAttributes.ISL_CHAOS_RECOVERED, recovered);
    if (recoveryTime !== undefined) {
      this.span.setAttribute(
        ISLSemanticAttributes.ISL_CHAOS_RECOVERY_TIME_MS,
        recoveryTime
      );
    }
    this.span.setAttribute('isl.chaos.system_behavior', systemBehavior);
    this.span.setAttribute('isl.duration_ms', duration);

    this.span.setStatus({
      code: recovered ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      message: recovered ? undefined : `System did not recover (${systemBehavior})`,
    });

    this.span.end();

    return {
      injectionType: this.config.injectionType,
      target: this.config.target,
      recovered,
      recoveryTime,
      systemBehavior,
      duration,
    };
  }

  /**
   * Mark chaos experiment as aborted
   */
  abort(reason: string): ChaosResult {
    const duration = Date.now() - this.startTime;

    this.span.addEvent('chaos.aborted', {
      reason,
      timestamp: Date.now(),
    });

    this.span.setAttribute('isl.duration_ms', duration);
    this.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `Chaos experiment aborted: ${reason}`,
    });
    this.span.end();

    return {
      injectionType: this.config.injectionType,
      target: this.config.target,
      recovered: false,
      systemBehavior: 'failed',
      duration,
    };
  }
}

/**
 * Execute a function within a chaos span context
 */
export async function withChaosSpan<T>(
  config: ChaosSpanConfig,
  fn: (span: ChaosSpan) => Promise<T>
): Promise<T> {
  const span = new ChaosSpan(config);
  span.startInjection();

  try {
    const result = await context.with(
      trace.setSpan(context.active(), span.getSpan()),
      () => fn(span)
    );
    span.endInjection();
    span.complete(true);
    return result;
  } catch (error) {
    span.endInjection();
    span.complete(false, 'failed');
    throw error;
  }
}

/**
 * Create a chaos span builder
 */
export function createChaosSpan(
  injectionType: ChaosInjectionType,
  target: string
): ChaosSpanBuilder {
  return new ChaosSpanBuilder(injectionType, target);
}

/**
 * Builder pattern for chaos spans
 */
export class ChaosSpanBuilder {
  private config: ChaosSpanConfig;

  constructor(injectionType: ChaosInjectionType, target: string) {
    this.config = { injectionType, target };
  }

  duration(ms: number): this {
    this.config.duration = ms;
    return this;
  }

  intensity(value: number): this {
    this.config.intensity = Math.max(0, Math.min(1, value));
    return this;
  }

  attribute(key: string, value: string | number | boolean): this {
    this.config.attributes = {
      ...this.config.attributes,
      [key]: value,
    };
    return this;
  }

  build(parentContext?: Context): ChaosSpan {
    return new ChaosSpan(this.config, parentContext);
  }

  async execute<T>(fn: (span: ChaosSpan) => Promise<T>): Promise<T> {
    return withChaosSpan(this.config, fn);
  }
}

/**
 * Chaos injection utilities
 */
export const ChaosUtils = {
  /**
   * Inject latency into a function
   */
  async injectLatency<T>(
    fn: () => Promise<T>,
    latencyMs: number,
    variance: number = 0
  ): Promise<T> {
    const actualLatency = latencyMs + Math.random() * variance * 2 - variance;
    await new Promise((resolve) => setTimeout(resolve, actualLatency));
    return fn();
  },

  /**
   * Inject errors into a function
   */
  async injectError<T>(
    fn: () => Promise<T>,
    errorRate: number,
    errorFactory: () => Error = () => new Error('Injected chaos error')
  ): Promise<T> {
    if (Math.random() < errorRate) {
      throw errorFactory();
    }
    return fn();
  },

  /**
   * Inject partial failures
   */
  async injectPartialFailure<T>(
    fn: () => Promise<T>,
    failureRate: number,
    fallback: T
  ): Promise<T> {
    if (Math.random() < failureRate) {
      return fallback;
    }
    return fn();
  },
};
