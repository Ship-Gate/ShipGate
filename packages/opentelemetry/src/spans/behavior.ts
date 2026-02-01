import {
  trace,
  Span,
  SpanKind,
  SpanStatusCode,
  Attributes,
  context,
  Context,
} from '@opentelemetry/api';
import { ISLSemanticAttributes } from '../semantic-attributes';

/**
 * Configuration for behavior span
 */
export interface BehaviorSpanConfig {
  domain: string;
  behavior: string;
  actor?: string;
  idempotencyKey?: string;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  attributes?: Attributes;
}

/**
 * Behavior execution result
 */
export interface BehaviorResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}

/**
 * Creates a behavior span for tracing ISL behavior execution
 */
export class BehaviorSpan {
  private span: Span;
  private startTime: number;
  private config: BehaviorSpanConfig;

  constructor(config: BehaviorSpanConfig, parentContext?: Context) {
    this.config = config;
    this.startTime = Date.now();

    const tracer = trace.getTracer('isl-verification', '1.0.0');

    this.span = tracer.startSpan(
      `isl.behavior.${config.domain}.${config.behavior}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ISLSemanticAttributes.ISL_DOMAIN_NAME]: config.domain,
          [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: config.behavior,
          ...(config.actor && {
            [ISLSemanticAttributes.ISL_BEHAVIOR_ACTOR]: config.actor,
          }),
          ...(config.idempotencyKey && {
            [ISLSemanticAttributes.ISL_BEHAVIOR_IDEMPOTENCY_KEY]: config.idempotencyKey,
          }),
          ...(config.timeout && {
            [ISLSemanticAttributes.ISL_BEHAVIOR_TIMEOUT_MS]: config.timeout,
          }),
          ...(config.retryCount !== undefined && {
            [ISLSemanticAttributes.ISL_BEHAVIOR_RETRY_COUNT]: config.retryCount,
          }),
          ...(config.maxRetries !== undefined && {
            [ISLSemanticAttributes.ISL_BEHAVIOR_MAX_RETRIES]: config.maxRetries,
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
   * Add an event to the span
   */
  addEvent(name: string, attributes?: Attributes): void {
    this.span.addEvent(name, attributes);
  }

  /**
   * Set additional attributes
   */
  setAttribute(key: string, value: string | number | boolean): void {
    this.span.setAttribute(key, value);
  }

  /**
   * Record entity state change
   */
  recordStateChange(entityType: string, entityId: string, from: string, to: string): void {
    this.span.addEvent('state_change', {
      [ISLSemanticAttributes.ISL_ENTITY_TYPE]: entityType,
      [ISLSemanticAttributes.ISL_ENTITY_ID]: entityId,
      [ISLSemanticAttributes.ISL_STATE_BEFORE]: from,
      [ISLSemanticAttributes.ISL_STATE_AFTER]: to,
      [ISLSemanticAttributes.ISL_STATE_TRANSITION]: `${from} -> ${to}`,
    });
  }

  /**
   * Mark the behavior as successful
   */
  success<T>(data?: T): BehaviorResult<T> {
    const duration = Date.now() - this.startTime;
    this.span.setAttribute('isl.duration_ms', duration);
    this.span.setStatus({ code: SpanStatusCode.OK });
    this.span.end();

    return { success: true, data, duration };
  }

  /**
   * Mark the behavior as failed
   */
  failure(error: Error): BehaviorResult {
    const duration = Date.now() - this.startTime;
    this.span.setAttribute('isl.duration_ms', duration);
    this.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    this.span.recordException(error);
    this.span.end();

    return { success: false, error, duration };
  }

  /**
   * End the span (for manual control)
   */
  end(): void {
    const duration = Date.now() - this.startTime;
    this.span.setAttribute('isl.duration_ms', duration);
    this.span.end();
  }
}

/**
 * Execute a function within a behavior span context
 */
export async function withBehaviorSpan<T>(
  config: BehaviorSpanConfig,
  fn: (span: BehaviorSpan) => Promise<T>
): Promise<T> {
  const span = new BehaviorSpan(config);

  try {
    const result = await context.with(
      trace.setSpan(context.active(), span.getSpan()),
      () => fn(span)
    );
    span.success(result);
    return result;
  } catch (error) {
    span.failure(error as Error);
    throw error;
  }
}

/**
 * Decorator for tracing behavior methods
 */
export function TraceBehavior(domain: string, behavior?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const behaviorName = behavior ?? propertyKey;

    descriptor.value = async function (...args: unknown[]) {
      const span = new BehaviorSpan({
        domain,
        behavior: behaviorName,
      });

      try {
        const result = await context.with(
          trace.setSpan(context.active(), span.getSpan()),
          () => originalMethod.apply(this, args)
        );
        span.success(result);
        return result;
      } catch (error) {
        span.failure(error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Create a behavior span builder
 */
export function createBehaviorSpan(domain: string, behavior: string): BehaviorSpanBuilder {
  return new BehaviorSpanBuilder(domain, behavior);
}

/**
 * Builder pattern for behavior spans
 */
export class BehaviorSpanBuilder {
  private config: BehaviorSpanConfig;

  constructor(domain: string, behavior: string) {
    this.config = { domain, behavior };
  }

  actor(actor: string): this {
    this.config.actor = actor;
    return this;
  }

  idempotencyKey(key: string): this {
    this.config.idempotencyKey = key;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  retry(count: number, max?: number): this {
    this.config.retryCount = count;
    if (max !== undefined) {
      this.config.maxRetries = max;
    }
    return this;
  }

  attribute(key: string, value: string | number | boolean): this {
    this.config.attributes = {
      ...this.config.attributes,
      [key]: value,
    };
    return this;
  }

  build(parentContext?: Context): BehaviorSpan {
    return new BehaviorSpan(this.config, parentContext);
  }

  async execute<T>(fn: (span: BehaviorSpan) => Promise<T>): Promise<T> {
    return withBehaviorSpan(this.config, fn);
  }
}
