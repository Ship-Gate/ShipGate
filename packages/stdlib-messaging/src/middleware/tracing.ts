/**
 * Tracing middleware
 */

import type { Middleware, ProduceContext, ConsumeContext } from '../types.js';
import type { HandlerResult } from '../types.js';

// ============================================================================
// TRACING INTERFACE
// ============================================================================

export interface Tracer {
  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span;
  
  /**
   * Get current span
   */
  getCurrentSpan(): Span | undefined;
  
  /**
   * Extract span context from headers
   */
  extract(headers: Record<string, string>): SpanContext | undefined;
  
  /**
   * Inject span context into headers
   */
  inject(span: Span, headers: Record<string, string>): void;
}

export interface Span {
  /** Span context */
  context: SpanContext;
  
  /** Set a tag */
  setTag(key: string, value: any): void;
  
  /** Set a baggage item */
  setBaggageItem(key: string, value: string): void;
  
  /** Log an event */
  log(event: string, data?: any): void;
  
  /** Finish the span */
  finish(endTime?: number): void;
  
  /** Set error status */
  setError(error: Error): void;
}

export interface SpanContext {
  /** Trace ID */
  traceId: string;
  
  /** Span ID */
  spanId: string;
  
  /** Parent span ID */
  parentSpanId?: string;
  
  /** Baggage items */
  baggage?: Record<string, string>;
  
  /** Additional flags */
  flags?: Record<string, any>;
}

export interface SpanOptions {
  /** Parent span context */
  childOf?: SpanContext;
  
  /** Start time */
  startTime?: number;
  
  /** Tags */
  tags?: Record<string, any>;
  
  /** Whether to ignore active span */
  ignoreActiveSpan?: boolean;
}

// ============================================================================
// DEFAULT TRACER IMPLEMENTATION
// ============================================================================

export class DefaultTracer implements Tracer {
  private activeSpan?: Span;
  
  startSpan(name: string, options?: SpanOptions): Span {
    const context: SpanContext = {
      traceId: options?.childOf?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: options?.childOf?.spanId || this.activeSpan?.context.spanId,
      baggage: options?.childOf?.baggage || this.activeSpan?.context.baggage,
    };
    
    const span = new DefaultSpan(
      name,
      context,
      options?.startTime || Date.now(),
      (finishedSpan) => {
        if (this.activeSpan === finishedSpan) {
          this.activeSpan = undefined;
        }
      }
    );
    
    // Set initial tags
    if (options?.tags) {
      for (const [key, value] of Object.entries(options.tags)) {
        span.setTag(key, value);
      }
    }
    
    this.activeSpan = span;
    return span;
  }
  
  getCurrentSpan(): Span | undefined {
    return this.activeSpan;
  }
  
  extract(headers: Record<string, string>): SpanContext | undefined {
    const traceId = headers['x-trace-id'] || headers['traceparent']?.split('-')[1];
    const spanId = headers['x-span-id'] || headers['traceparent']?.split('-')[2];
    
    if (!traceId || !spanId) {
      return undefined;
    }
    
    const baggage: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key.startsWith('x-baggage-')) {
        baggage[key.substring(10)] = value;
      }
    }
    
    return {
      traceId,
      spanId,
      baggage: Object.keys(baggage).length > 0 ? baggage : undefined,
    };
  }
  
  inject(span: Span, headers: Record<string, string>): void {
    headers['x-trace-id'] = span.context.traceId;
    headers['x-span-id'] = span.context.spanId;
    
    if (span.context.parentSpanId) {
      headers['x-parent-span-id'] = span.context.parentSpanId;
    }
    
    // Inject baggage
    if (span.context.baggage) {
      for (const [key, value] of Object.entries(span.context.baggage)) {
        headers[`x-baggage-${key}`] = value;
      }
    }
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export class DefaultSpan implements Span {
  private finished = false;
  private tags: Record<string, any> = {};
  private logs: Array<{ timestamp: number; event: string; data?: any }> = [];
  private endTime?: number;
  
  constructor(
    public readonly name: string,
    public readonly context: SpanContext,
    public readonly startTime: number,
    private readonly onFinish: (span: Span) => void
  ) {}
  
  setTag(key: string, value: any): void {
    if (this.finished) return;
    this.tags[key] = value;
  }
  
  setBaggageItem(key: string, value: string): void {
    if (this.finished) return;
    if (!this.context.baggage) {
      this.context.baggage = {};
    }
    this.context.baggage[key] = value;
  }
  
  log(event: string, data?: any): void {
    if (this.finished) return;
    this.logs.push({
      timestamp: Date.now(),
      event,
      data,
    });
  }
  
  finish(endTime?: number): void {
    if (this.finished) return;
    this.finished = true;
    this.endTime = endTime || Date.now();
    this.onFinish(this);
  }
  
  setError(error: Error): void {
    if (this.finished) return;
    this.setTag('error', true);
    this.setTag('error.message', error.message);
    this.setTag('error.stack', error.stack);
    this.log('error', { message: error.message, stack: error.stack });
  }
  
  get duration(): number | undefined {
    return this.endTime ? this.endTime - this.startTime : undefined;
  }
  
  getTags(): Record<string, any> {
    return { ...this.tags };
  }
  
  getLogs(): Array<{ timestamp: number; event: string; data?: any }> {
    return [...this.logs];
  }
}

// ============================================================================
// TRACING MIDDLEWARE
// ============================================================================

export interface TracingOptions {
  /** Tracer instance */
  tracer: Tracer;
  
  /** Span names */
  spanNames?: {
    produce?: string;
    consume?: string;
  };
  
  /** Tags to add to all spans */
  defaultTags?: Record<string, any>;
  
  /** Whether to trace message payloads */
  tracePayloads?: boolean;
  
  /** Maximum payload size to trace */
  maxPayloadSize?: number;
}

export class TracingMiddleware implements Middleware {
  readonly name = 'tracing';
  
  private readonly spanNames: Required<NonNullable<TracingOptions['spanNames']>>;
  
  constructor(private readonly options: TracingOptions) {
    this.spanNames = {
      produce: 'messaging.produce',
      consume: 'messaging.consume',
      ...options.spanNames,
    };
  }
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    // Extract existing trace context or start new one
    const parentContext = this.options.tracer.extract(context.message.headers);
    
    const span = this.options.tracer.startSpan(this.spanNames.produce, {
      childOf: parentContext,
      tags: {
        'messaging.system': 'stdlib-messaging',
        'messaging.destination': context.queue,
        'messaging.message_id': context.message.id,
        'messaging.message_payload_size': this.getPayloadSize(context.message.payload),
        ...this.options.defaultTags,
      },
    });
    
    try {
      // Inject trace context into message headers
      this.options.tracer.inject(span, context.message.headers);
      
      // Add payload as tag if configured
      if (this.options.tracePayloads && this.shouldTracePayload(context.message)) {
        span.setTag('messaging.message_payload', context.message.payload);
      }
      
      span.log('message.produce.start');
      
      await next();
      
      span.log('message.produce.success');
      span.setTag('messaging.operation', 'send');
    } catch (error) {
      span.setError(error as Error);
      span.log('message.produce.error', { error: (error as Error).message });
      throw error;
    } finally {
      span.finish();
    }
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    // Extract trace context from message
    const parentContext = this.options.tracer.extract(context.message.headers);
    
    const span = this.options.tracer.startSpan(this.spanNames.consume, {
      childOf: parentContext,
      tags: {
        'messaging.system': 'stdlib-messaging',
        'messaging.source': context.queue,
        'messaging.message_id': context.message.id,
        'messaging.message_payload_size': this.getPayloadSize(context.message.payload),
        'messaging.delivery_count': context.message.deliveryCount,
        ...this.options.defaultTags,
      },
    });
    
    try {
      // Add payload as tag if configured
      if (this.options.tracePayloads && this.shouldTracePayload(context.message)) {
        span.setTag('messaging.message_payload', context.message.payload);
      }
      
      span.log('message.consume.start');
      
      const result = await next();
      
      span.log('message.consume.success');
      span.setTag('messaging.operation', 'receive');
      span.setTag('messaging.consume.result', result);
      
      return result;
    } catch (error) {
      span.setError(error as Error);
      span.log('message.consume.error', { error: (error as Error).message });
      throw error;
    } finally {
      span.finish();
    }
  }
  
  private shouldTracePayload(message: any): boolean {
    if (!this.options.tracePayloads) {
      return false;
    }
    
    const maxSize = this.options.maxPayloadSize || 1024;
    return this.getPayloadSize(message.payload) <= maxSize;
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
// OPENTELEMETRY TRACER ADAPTER
// ============================================================================

export class OpenTelemetryTracerAdapter implements Tracer {
  constructor(private readonly tracer: any) {} // Would be @opentelemetry/api.Tracer
  
  startSpan(name: string, options?: SpanOptions): Span {
    const otOptions: any = {
      startTime: options?.startTime,
    };
    
    if (options?.childOf) {
      otOptions.parent = {
        traceId: options.childOf.traceId,
        spanId: options.childOf.spanId,
      };
    }
    
    const otSpan = this.tracer.startSpan(name, otOptions);
    
    return new OpenTelemetrySpanAdapter(otSpan);
  }
  
  getCurrentSpan(): Span | undefined {
    const otSpan = this.tracer.getCurrentSpan();
    return otSpan ? new OpenTelemetrySpanAdapter(otSpan) : undefined;
  }
  
  extract(headers: Record<string, string>): SpanContext | undefined {
    const carrier = { ...headers };
    const context = this.tracer.extract('HTTP_HEADERS', carrier);
    
    if (!context) {
      return undefined;
    }
    
    return {
      traceId: context.traceId,
      spanId: context.spanId,
    };
  }
  
  inject(span: Span, headers: Record<string, string>): void {
    const otSpan = (span as OpenTelemetrySpanAdapter).getSpan();
    const carrier = { ...headers };
    this.tracer.inject(otSpan, 'HTTP_HEADERS', carrier);
    
    // Copy back to headers
    Object.assign(headers, carrier);
  }
}

export class OpenTelemetrySpanAdapter implements Span {
  constructor(private readonly span: any) {} // Would be @opentelemetry/api.Span
  
  get context(): SpanContext {
    return {
      traceId: this.span.spanContext().traceId,
      spanId: this.span.spanContext().spanId,
      parentSpanId: this.span.parentSpanId,
    };
  }
  
  setTag(key: string, value: any): void {
    this.span.setAttribute(key, value);
  }
  
  setBaggageItem(key: string, value: string): void {
    this.span.setBaggageItem(key, value);
  }
  
  log(event: string, data?: any): void {
    this.span.addEvent(event, data);
  }
  
  finish(endTime?: number): void {
    this.span.end(endTime);
  }
  
  setError(error: Error): void {
    this.span.recordException(error);
    this.span.setStatus({ code: 2, message: error.message }); // ERROR status
  }
  
  getSpan(): any {
    return this.span;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a tracing middleware with default tracer
 */
export function createTracingMiddleware(
  options?: Partial<TracingOptions>
): TracingMiddleware {
  const tracer = new DefaultTracer();
  
  return new TracingMiddleware({
    tracer,
    tracePayloads: false,
    maxPayloadSize: 1024,
    ...options,
  });
}

/**
 * Create a tracing middleware with custom tracer
 */
export function createCustomTracingMiddleware(
  tracer: Tracer,
  options?: Omit<TracingOptions, 'tracer'>
): TracingMiddleware {
  return new TracingMiddleware({
    tracer,
    tracePayloads: false,
    maxPayloadSize: 1024,
    ...options,
  });
}

/**
 * Create a tracing middleware with OpenTelemetry
 */
export function createOpenTelemetryTracingMiddleware(
  tracer: any, // @opentelemetry/api.Tracer
  options?: Omit<TracingOptions, 'tracer'>
): TracingMiddleware {
  const adapter = new OpenTelemetryTracerAdapter(tracer);
  
  return new TracingMiddleware({
    tracer: adapter,
    tracePayloads: false,
    maxPayloadSize: 1024,
    ...options,
  });
}
