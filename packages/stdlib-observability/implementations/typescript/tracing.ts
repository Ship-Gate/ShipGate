// ============================================================================
// Observability Standard Library - Tracing Implementation
// @isl-lang/stdlib-observability
// ============================================================================

/// <reference types="node" />

import {
  TraceId,
  SpanId,
  SpanKind,
  SpanStatus,
  Span,
  Trace,
  SpanContext,
  SpanEvent,
  SpanResource,
  StartSpanInput,
  StartSpanOutput,
  EndSpanInput,
  AddSpanEventInput,
  SetSpanAttributeInput,
  InjectContextInput,
  ExtractContextInput,
  PropagationFormat,
  SpanExporter,
  Result,
  success,
  failure,
} from './types';

// ============================================================================
// ID Generation
// ============================================================================

declare const crypto: {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
} | undefined;

function generateTraceId(): TraceId {
  // Generate 32 hex chars (16 bytes)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSpanId(): SpanId {
  // Generate 16 hex chars (8 bytes)
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Context Propagation
// ============================================================================

const W3C_TRACEPARENT_HEADER = 'traceparent';
const W3C_TRACESTATE_HEADER = 'tracestate';
const B3_SINGLE_HEADER = 'b3';
const B3_TRACE_ID_HEADER = 'x-b3-traceid';
const B3_SPAN_ID_HEADER = 'x-b3-spanid';
const B3_SAMPLED_HEADER = 'x-b3-sampled';
// B3_PARENT_SPAN_ID_HEADER is exported for use in B3 multi-header propagation
export const B3_PARENT_SPAN_ID_HEADER = 'x-b3-parentspanid';

export function injectContext(input: InjectContextInput): Record<string, string> {
  const { context, carrier, format = PropagationFormat.W3C_TRACE_CONTEXT } = input;
  const result = { ...carrier };

  switch (format) {
    case PropagationFormat.W3C_TRACE_CONTEXT: {
      // Format: 00-{trace_id}-{span_id}-{trace_flags}
      const version = '00';
      const traceFlags = context.traceFlags.toString(16).padStart(2, '0');
      result[W3C_TRACEPARENT_HEADER] =
        `${version}-${context.traceId}-${context.spanId}-${traceFlags}`;
      if (context.traceState) {
        result[W3C_TRACESTATE_HEADER] = context.traceState;
      }
      break;
    }
    case PropagationFormat.B3_SINGLE: {
      // Format: {trace_id}-{span_id}-{sampling_state}
      const sampled = context.traceFlags & 0x01 ? '1' : '0';
      result[B3_SINGLE_HEADER] =
        `${context.traceId}-${context.spanId}-${sampled}`;
      break;
    }
    case PropagationFormat.B3_MULTI: {
      result[B3_TRACE_ID_HEADER] = context.traceId;
      result[B3_SPAN_ID_HEADER] = context.spanId;
      result[B3_SAMPLED_HEADER] = context.traceFlags & 0x01 ? '1' : '0';
      break;
    }
    default:
      // Unsupported format, return carrier as-is
      break;
  }

  return result;
}

export function extractContext(
  input: ExtractContextInput
): SpanContext | null {
  const { carrier, format = PropagationFormat.W3C_TRACE_CONTEXT } = input;

  switch (format) {
    case PropagationFormat.W3C_TRACE_CONTEXT: {
      const traceparent = carrier[W3C_TRACEPARENT_HEADER];
      if (!traceparent) return null;

      const parts = traceparent.split('-');
      if (parts.length !== 4) return null;

      const [, traceId, spanId, flags] = parts;
      if (!traceId || !spanId) return null;

      return {
        traceId,
        spanId,
        traceFlags: parseInt(flags ?? '0', 16) || 0,
        traceState: carrier[W3C_TRACESTATE_HEADER],
        remote: true,
      };
    }
    case PropagationFormat.B3_SINGLE: {
      const b3 = carrier[B3_SINGLE_HEADER];
      if (!b3) return null;

      const parts = b3.split('-');
      if (parts.length < 2) return null;

      const [traceId, spanId, sampled] = parts;
      if (!traceId || !spanId) return null;

      return {
        traceId,
        spanId,
        traceFlags: sampled === '1' || sampled === 'd' ? 1 : 0,
        remote: true,
      };
    }
    case PropagationFormat.B3_MULTI: {
      const traceId = carrier[B3_TRACE_ID_HEADER];
      const spanId = carrier[B3_SPAN_ID_HEADER];
      if (!traceId || !spanId) return null;

      const sampled = carrier[B3_SAMPLED_HEADER];

      return {
        traceId,
        spanId,
        traceFlags: sampled === '1' ? 1 : 0,
        remote: true,
      };
    }
    default:
      return null;
  }
}

// ============================================================================
// Console Exporter (Default)
// ============================================================================

export class ConsoleSpanExporter implements SpanExporter {
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      const durationStr = span.durationMs
        ? `${span.durationMs.toFixed(2)}ms`
        : 'pending';
      const output = `[SPAN] ${span.name} trace_id=${span.traceId} span_id=${span.spanId} status=${span.status} duration=${durationStr}`;
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

export class InMemorySpanExporter implements SpanExporter {
  private spans: Span[] = [];

  async export(spans: Span[]): Promise<void> {
    this.spans.push(...spans);
  }

  async shutdown(): Promise<void> {
    this.spans = [];
  }

  getSpans(): Span[] {
    return [...this.spans];
  }

  getSpansByTrace(traceId: TraceId): Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  clear(): void {
    this.spans = [];
  }
}

// ============================================================================
// Tracer Configuration
// ============================================================================

export interface TracerConfig {
  serviceName: string;
  serviceVersion?: string;
  resource?: SpanResource;
  sampler?: (traceId: TraceId) => boolean;
}

const DEFAULT_TRACER_CONFIG: TracerConfig = {
  serviceName: 'unknown',
};

// ============================================================================
// Tracer Class
// ============================================================================

export class Tracer {
  private readonly config: TracerConfig;
  private readonly exporters: SpanExporter[];
  private readonly activeSpans: Map<SpanId, Span> = new Map();
  private readonly traces: Map<TraceId, Trace> = new Map();
  private currentContext: SpanContext | null = null;

  constructor(
    config: Partial<TracerConfig> = {},
    exporters: SpanExporter[] = []
  ) {
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config };
    this.exporters = exporters;
  }

  // ==========================================================================
  // Span Lifecycle
  // ==========================================================================

  startSpan(input: StartSpanInput): Result<StartSpanOutput> {
    try {
      const {
        name,
        kind = SpanKind.INTERNAL,
        parentContext,
        attributes,
        links,
      } = input;

      // Determine trace ID
      let traceId: TraceId;
      let parentSpanId: SpanId | undefined;

      if (parentContext) {
        traceId = parentContext.traceId;
        parentSpanId = parentContext.spanId;
      } else if (this.currentContext) {
        traceId = this.currentContext.traceId;
        parentSpanId = this.currentContext.spanId;
      } else {
        traceId = generateTraceId();
      }

      // Check sampler
      if (this.config.sampler && !this.config.sampler(traceId)) {
        // Not sampled, return a no-op span
        const spanId = generateSpanId();
        const context: SpanContext = {
          traceId,
          spanId,
          traceFlags: 0, // Not sampled
          remote: false,
        };
        const span: Span = {
          spanId,
          traceId,
          parentSpanId,
          name,
          kind,
          service: this.config.serviceName,
          startTime: new Date(),
          status: SpanStatus.UNSET,
        };
        return success({ span, context });
      }

      const spanId = generateSpanId();
      const startTime = new Date();

      const span: Span = {
        spanId,
        traceId,
        parentSpanId,
        name,
        kind,
        service: this.config.serviceName,
        startTime,
        status: SpanStatus.UNSET,
        attributes,
        links,
        events: [],
        resource: this.config.resource ?? {
          serviceName: this.config.serviceName,
          serviceVersion: this.config.serviceVersion,
        },
      };

      const context: SpanContext = {
        traceId,
        spanId,
        traceFlags: 1, // Sampled
        remote: false,
      };

      this.activeSpans.set(spanId, span);

      // Create or update trace
      if (!this.traces.has(traceId)) {
        this.traces.set(traceId, {
          traceId,
          name,
          service: this.config.serviceName,
          startTime,
          status: SpanStatus.UNSET,
          spans: [span],
        });
      } else {
        this.traces.get(traceId)!.spans.push(span);
      }

      // Update current context
      this.currentContext = context;

      return success({ span, context });
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  endSpan(input: EndSpanInput): Result<Span> {
    try {
      const { spanId, status, statusMessage } = input;

      const span = this.activeSpans.get(spanId);
      if (!span) {
        return failure(new Error(`Span not found: ${spanId}`));
      }

      const endTime = new Date();
      span.endTime = endTime;
      span.durationMs = endTime.getTime() - span.startTime.getTime();
      span.status = status ?? SpanStatus.OK;
      span.statusMessage = statusMessage;

      this.activeSpans.delete(spanId);

      // Update trace
      const trace = this.traces.get(span.traceId);
      if (trace) {
        // Check if all spans are complete
        const allComplete = trace.spans.every((s) => s.endTime !== undefined);
        if (allComplete) {
          trace.endTime = endTime;
          trace.durationMs = endTime.getTime() - trace.startTime.getTime();
          trace.status = trace.spans.some((s) => s.status === SpanStatus.ERROR)
            ? SpanStatus.ERROR
            : SpanStatus.OK;
        }
      }

      // Export span
      this.exportSpan(span);

      // Reset context if this was the root span
      if (!span.parentSpanId && this.currentContext?.spanId === spanId) {
        this.currentContext = null;
      }

      return success(span);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ==========================================================================
  // Span Manipulation
  // ==========================================================================

  addSpanEvent(input: AddSpanEventInput): Result<void> {
    try {
      const { spanId, name, attributes } = input;

      const span = this.activeSpans.get(spanId);
      if (!span) {
        return failure(new Error(`Span not found: ${spanId}`));
      }

      const event: SpanEvent = {
        name,
        timestamp: new Date(),
        attributes,
      };

      span.events = span.events ?? [];
      span.events.push(event);

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  setSpanAttribute(input: SetSpanAttributeInput): Result<void> {
    try {
      const { spanId, key, value } = input;

      const span = this.activeSpans.get(spanId);
      if (!span) {
        return failure(new Error(`Span not found: ${spanId}`));
      }

      span.attributes = span.attributes ?? {};
      span.attributes[key] = value;

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  setSpanStatus(
    spanId: SpanId,
    status: SpanStatus,
    message?: string
  ): Result<void> {
    try {
      const span = this.activeSpans.get(spanId);
      if (!span) {
        return failure(new Error(`Span not found: ${spanId}`));
      }

      span.status = status;
      span.statusMessage = message;

      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ==========================================================================
  // Context Management
  // ==========================================================================

  getCurrentContext(): SpanContext | null {
    return this.currentContext;
  }

  setCurrentContext(context: SpanContext | null): void {
    this.currentContext = context;
  }

  withContext<T>(context: SpanContext, fn: () => T): T {
    const previousContext = this.currentContext;
    this.currentContext = context;
    try {
      return fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  async withContextAsync<T>(
    context: SpanContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const previousContext = this.currentContext;
    this.currentContext = context;
    try {
      return await fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: Omit<StartSpanInput, 'name'> = {}
  ): Promise<T> {
    const result = this.startSpan({ name, ...options });
    if (!result.success) {
      throw result.error;
    }

    const { span, context } = result.value;

    try {
      const returnValue = await this.withContextAsync(context, () => fn(span));
      this.endSpan({ spanId: span.spanId, status: SpanStatus.OK });
      return returnValue;
    } catch (error) {
      this.setSpanStatus(span.spanId, SpanStatus.ERROR, String(error));
      if (error instanceof Error) {
        this.addSpanEvent({
          spanId: span.spanId,
          name: 'exception',
          attributes: {
            'exception.type': error.name,
            'exception.message': error.message,
            'exception.stacktrace': error.stack,
          },
        });
      }
      this.endSpan({ spanId: span.spanId, status: SpanStatus.ERROR });
      throw error;
    }
  }

  // ==========================================================================
  // Export
  // ==========================================================================

  private async exportSpan(span: Span): Promise<void> {
    await Promise.all(
      this.exporters.map((exporter) => exporter.export([span]))
    );
  }

  async shutdown(): Promise<void> {
    // End all active spans
    for (const [spanId] of this.activeSpans) {
      this.endSpan({ spanId, status: SpanStatus.ERROR, statusMessage: 'Tracer shutdown' });
    }

    await Promise.all(this.exporters.map((exporter) => exporter.shutdown()));
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getActiveSpan(spanId: SpanId): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  getTrace(traceId: TraceId): Trace | undefined {
    return this.traces.get(traceId);
  }
}

// ============================================================================
// Default Tracer
// ============================================================================

let defaultTracer: Tracer | null = null;

export function getDefaultTracer(): Tracer {
  if (!defaultTracer) {
    defaultTracer = new Tracer();
  }
  return defaultTracer;
}

export function setDefaultTracer(tracer: Tracer): void {
  defaultTracer = tracer;
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  Tracer,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  injectContext,
  extractContext,
  getDefaultTracer,
  setDefaultTracer,
};
