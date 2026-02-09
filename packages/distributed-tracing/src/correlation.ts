/**
 * Correlation ID utilities for distributed tracing
 * 
 * Provides vendor-agnostic correlation ID propagation across:
 * - HTTP headers
 * - Logs
 * - Traces
 */

import { trace, context, propagation } from '@opentelemetry/api';

/**
 * Standard correlation ID header names
 */
export const CORRELATION_HEADERS = {
  /** W3C Trace Context - standard format */
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
  /** Custom correlation ID header */
  CORRELATION_ID: 'x-correlation-id',
  /** Trace ID header (for compatibility) */
  TRACE_ID: 'x-trace-id',
  /** Span ID header (for compatibility) */
  SPAN_ID: 'x-span-id',
} as const;

/**
 * Correlation context data
 */
export interface CorrelationContext {
  /** Trace ID (W3C format) */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** Correlation ID (can be same as traceId or custom) */
  correlationId: string;
  /** Trace flags */
  traceFlags?: number;
  /** Trace state */
  traceState?: string;
}

/**
 * Get current correlation context from active span
 */
export function getCorrelationContext(): CorrelationContext | null {
  const span = trace.getActiveSpan();
  if (!span) return null;

  const spanContext = span.spanContext();
  if (!spanContext.traceId || spanContext.traceId === '00000000000000000000000000000000') {
    return null;
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    correlationId: spanContext.traceId, // Use traceId as correlationId by default
    traceFlags: spanContext.traceFlags,
    traceState: spanContext.traceState?.serialize(),
  };
}

/**
 * Extract correlation context from headers
 */
export function extractCorrelationFromHeaders(
  headers: Record<string, string | string[] | undefined>
): CorrelationContext | null {
  // Try W3C traceparent header first
  const traceparent = getHeaderValue(headers, CORRELATION_HEADERS.TRACEPARENT);
  if (traceparent) {
    const parsed = parseTraceparent(traceparent);
    if (parsed) {
      return {
        traceId: parsed.traceId,
        spanId: parsed.spanId,
        correlationId: parsed.traceId,
        traceFlags: parsed.traceFlags,
        traceState: getHeaderValue(headers, CORRELATION_HEADERS.TRACESTATE) || undefined,
      };
    }
  }

  // Fallback to custom headers
  const traceId = getHeaderValue(headers, CORRELATION_HEADERS.TRACE_ID);
  const spanId = getHeaderValue(headers, CORRELATION_HEADERS.SPAN_ID);
  const correlationId = getHeaderValue(headers, CORRELATION_HEADERS.CORRELATION_ID);

  if (traceId && spanId) {
    return {
      traceId,
      spanId,
      correlationId: correlationId ?? traceId,
    };
  }

  return null;
}

/**
 * Inject correlation context into headers
 */
export function injectCorrelationToHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  const ctx = getCorrelationContext();
  if (!ctx) return headers;

  // Use OpenTelemetry propagation to inject W3C headers
  propagation.inject(context.active(), headers);

  // Also add custom headers for compatibility
  headers[CORRELATION_HEADERS.CORRELATION_ID] = ctx.correlationId;
  headers[CORRELATION_HEADERS.TRACE_ID] = ctx.traceId;
  headers[CORRELATION_HEADERS.SPAN_ID] = ctx.spanId;

  return headers;
}

/**
 * Get correlation ID for logging
 * Returns the correlation ID from current context, or null if not available
 */
export function getCorrelationId(): string | null {
  const ctx = getCorrelationContext();
  return ctx?.correlationId ?? null;
}

/**
 * Get correlation metadata for logs
 * Returns an object with traceId, spanId, and correlationId
 */
export function getCorrelationMetadata(): Record<string, string> | null {
  const ctx = getCorrelationContext();
  if (!ctx) return null;

  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    correlationId: ctx.correlationId,
  };
}

/**
 * Run a function within a correlation context
 */
export function runWithCorrelationContext<T>(
  correlationCtx: CorrelationContext | null,
  fn: () => T
): T {
  if (!correlationCtx) {
    return fn();
  }

  // Extract context from headers
  const headers: Record<string, string> = {};
  if (correlationCtx.traceId && correlationCtx.spanId) {
    // Create traceparent header
    const traceFlags = (correlationCtx.traceFlags ?? 1).toString(16).padStart(2, '0');
    headers[CORRELATION_HEADERS.TRACEPARENT] = `00-${correlationCtx.traceId}-${correlationCtx.spanId}-${traceFlags}`;
    if (correlationCtx.traceState) {
      headers[CORRELATION_HEADERS.TRACESTATE] = correlationCtx.traceState;
    }
  }

  const extractedContext = propagation.extract(context.active(), headers);
  return context.with(extractedContext, fn);
}

// Helper functions

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name.toLowerCase()];
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Parse W3C traceparent header
 * Format: version-trace_id-parent_id-trace_flags
 */
function parseTraceparent(traceparent: string): {
  traceId: string;
  spanId: string;
  traceFlags: number;
} | null {
  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;

  const [, traceId, spanId, traceFlagsStr] = parts;
  const traceFlags = parseInt(traceFlagsStr ?? '0', 16);

  if (!traceId || !spanId || isNaN(traceFlags)) {
    return null;
  }

  return {
    traceId,
    spanId,
    traceFlags,
  };
}
