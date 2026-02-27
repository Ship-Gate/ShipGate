// ============================================================================
// Datadog Tracing - Span Management
// ============================================================================

import type { DatadogClient } from '../client.js';
import type { SpanOptions, Span, SpanContext, Domain, Behavior } from '../types.js';

/**
 * Span attributes for ISL verification
 */
export interface ISLSpanAttributes {
  'isl.domain': string;
  'isl.behavior': string;
  'isl.operation'?: string;
  'isl.verdict'?: string;
  'isl.score'?: number;
  'isl.check_type'?: string;
  'isl.check_passed'?: boolean;
}

/**
 * Span builder for creating customized spans
 */
export class SpanBuilder {
  private options: SpanOptions;
  private _tags: Record<string, string | number | boolean> = {};

  constructor(domain: string, behavior: string) {
    this.options = { domain, behavior };
  }

  /**
   * Set operation type
   */
  operationType(type: 'verification' | 'execution' | 'check'): this {
    this.options.operationType = type;
    return this;
  }

  /**
   * Set parent context for distributed tracing
   */
  withParent(context: SpanContext): this {
    this.options.parentContext = context;
    return this;
  }

  /**
   * Add a tag
   */
  tag(key: string, value: string | number | boolean): this {
    this._tags[key] = value;
    return this;
  }

  /**
   * Add multiple tags
   */
  tags(tags: Record<string, string | number | boolean>): this {
    Object.assign(this._tags, tags);
    return this;
  }

  /**
   * Build span options
   */
  build(): SpanOptions {
    return {
      ...this.options,
      tags: this._tags,
    };
  }
}

/**
 * ISL Tracer for managing distributed traces
 * 
 * Provides span management for ISL verification tracing including:
 * - Behavior execution tracing
 * - Verification tracing
 * - Check-level tracing
 * - Distributed context propagation
 * 
 * @example
 * ```typescript
 * const tracer = new ISLTracer(client);
 * 
 * // Trace a behavior execution
 * const result = await tracer.traceBehavior('auth', 'login', async (span) => {
 *   span.setTag('user.id', userId);
 *   return await loginUser(credentials);
 * });
 * 
 * // Or use manual span management
 * const span = tracer.startSpan('auth', 'login');
 * try {
 *   // ... do work
 *   span.setTag('isl.success', true);
 * } finally {
 *   span.finish();
 * }
 * ```
 */
export class ISLTracer {
  private client: DatadogClient;
  private activeSpans: Map<string, Span> = new Map();

  constructor(client: DatadogClient) {
    this.client = client;
  }

  /**
   * Start a new span
   */
  startSpan(domain: string, behavior: string, options?: Partial<SpanOptions>): Span {
    const spanOptions: SpanOptions = {
      domain,
      behavior,
      ...options,
    };

    const span = this.client.startSpan(spanOptions);
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * Start a span using builder pattern
   */
  startSpanWithBuilder(builder: SpanBuilder): Span {
    const options = builder.build();
    return this.startSpan(options.domain, options.behavior, options);
  }

  /**
   * Create a span builder
   */
  buildSpan(domain: string, behavior: string): SpanBuilder {
    return new SpanBuilder(domain, behavior);
  }

  /**
   * Trace a behavior execution with automatic span management
   */
  async traceBehavior<T>(
    domain: string,
    behavior: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(domain, behavior, { operationType: 'execution' });

    try {
      const result = await fn(span);
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
      this.activeSpans.delete(span.spanId);
    }
  }

  /**
   * Trace a verification
   */
  async traceVerification<T>(
    domain: string,
    behavior: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(domain, behavior, { operationType: 'verification' });

    try {
      const result = await fn(span);
      span.setTag('isl.verification.complete', true);
      return result;
    } catch (error) {
      span.setTag('isl.verification.complete', false);
      if (error instanceof Error) {
        span.setError(error);
      }
      throw error;
    } finally {
      span.finish();
      this.activeSpans.delete(span.spanId);
    }
  }

  /**
   * Trace an individual check within a verification
   */
  async traceCheck<T>(
    domain: string,
    behavior: string,
    checkType: string,
    parentSpan: Span,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(domain, behavior, {
      operationType: 'check',
      parentContext: {
        traceId: parentSpan.traceId,
        spanId: parentSpan.spanId,
      },
      tags: {
        'isl.check_type': checkType,
      },
    });

    try {
      const result = await fn(span);
      span.setTag('isl.check_passed', true);
      return result;
    } catch (error) {
      span.setTag('isl.check_passed', false);
      if (error instanceof Error) {
        span.setError(error);
      }
      throw error;
    } finally {
      span.finish();
      this.activeSpans.delete(span.spanId);
    }
  }

  /**
   * Trace all behaviors in a domain
   */
  async traceDomain<T>(
    domain: Domain,
    fn: (domain: Domain, span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(domain.name, '_domain', {
      operationType: 'verification',
      tags: {
        'isl.domain.behaviors': domain.behaviors.length,
      },
    });

    try {
      const result = await fn(domain, span);
      span.setTag('isl.domain.complete', true);
      return result;
    } catch (error) {
      span.setTag('isl.domain.complete', false);
      if (error instanceof Error) {
        span.setError(error);
      }
      throw error;
    } finally {
      span.finish();
      this.activeSpans.delete(span.spanId);
    }
  }

  /**
   * Create a child span from parent context
   */
  createChildSpan(
    domain: string,
    behavior: string,
    parentContext: SpanContext
  ): Span {
    return this.startSpan(domain, behavior, { parentContext });
  }

  /**
   * Get context for distributed tracing propagation
   */
  getTraceContext(span: Span): SpanContext {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
    };
  }

  /**
   * Inject trace context into headers for HTTP propagation
   */
  injectHeaders(span: Span): Record<string, string> {
    return {
      'x-datadog-trace-id': span.traceId,
      'x-datadog-parent-id': span.spanId,
      'x-datadog-sampling-priority': '1',
    };
  }

  /**
   * Extract trace context from headers
   */
  extractHeaders(headers: Record<string, string | undefined>): SpanContext | null {
    const traceId = headers['x-datadog-trace-id'];
    const spanId = headers['x-datadog-parent-id'];

    if (!traceId || !spanId) {
      return null;
    }

    return {
      traceId,
      spanId,
      sampled: headers['x-datadog-sampling-priority'] !== '0',
    };
  }

  /**
   * Get active span count
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Finish all active spans (cleanup)
   */
  finishAll(): void {
    for (const span of this.activeSpans.values()) {
      span.setTag('isl.forced_finish', true);
      span.finish();
    }
    this.activeSpans.clear();
  }
}

/**
 * Create an ISL tracer
 */
export function createISLTracer(client: DatadogClient): ISLTracer {
  return new ISLTracer(client);
}

/**
 * Decorator for tracing class methods
 */
export function Traced(domain: string, behavior: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { tracer?: ISLTracer }, ...args: unknown[]) {
      if (!this.tracer) {
        return originalMethod.apply(this, args);
      }

      return this.tracer.traceBehavior(domain, behavior, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
