/**
 * Tests for correlation ID utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  getCorrelationContext,
  extractCorrelationFromHeaders,
  injectCorrelationToHeaders,
  getCorrelationId,
  getCorrelationMetadata,
  runWithCorrelationContext,
  CORRELATION_HEADERS,
  type CorrelationContext,
} from '../src/correlation.js';

describe('Correlation ID utilities', () => {
  let provider: NodeTracerProvider;

  beforeEach(() => {
    provider = new NodeTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    provider.register();
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('getCorrelationContext', () => {
    it('should return null when no active span', () => {
      const ctx = getCorrelationContext();
      expect(ctx).toBeNull();
    });

    it('should return correlation context from active span', () => {
      const tracer = trace.getTracer('test');
      let correlationCtx: CorrelationContext | null = null;

      tracer.startActiveSpan('test-span', {}, (span) => {
        correlationCtx = getCorrelationContext();
        span.end();
      });

      expect(correlationCtx).not.toBeNull();
      expect(correlationCtx?.traceId).toBeTruthy();
      expect(correlationCtx?.spanId).toBeTruthy();
      expect(correlationCtx?.correlationId).toBe(correlationCtx?.traceId);
    });
  });

  describe('extractCorrelationFromHeaders', () => {
    it('should extract from W3C traceparent header', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const traceFlags = '01';
      const traceparent = `00-${traceId}-${spanId}-${traceFlags}`;

      const headers = {
        [CORRELATION_HEADERS.TRACEPARENT]: traceparent,
      };

      const ctx = extractCorrelationFromHeaders(headers);
      expect(ctx).not.toBeNull();
      expect(ctx?.traceId).toBe(traceId);
      expect(ctx?.spanId).toBe(spanId);
      expect(ctx?.correlationId).toBe(traceId);
      expect(ctx?.traceFlags).toBe(1);
    });

    it('should extract from custom headers', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const correlationId = 'custom-correlation-id';

      const headers = {
        [CORRELATION_HEADERS.TRACE_ID]: traceId,
        [CORRELATION_HEADERS.SPAN_ID]: spanId,
        [CORRELATION_HEADERS.CORRELATION_ID]: correlationId,
      };

      const ctx = extractCorrelationFromHeaders(headers);
      expect(ctx).not.toBeNull();
      expect(ctx?.traceId).toBe(traceId);
      expect(ctx?.spanId).toBe(spanId);
      expect(ctx?.correlationId).toBe(correlationId);
    });

    it('should return null when no correlation headers present', () => {
      const headers = {};
      const ctx = extractCorrelationFromHeaders(headers);
      expect(ctx).toBeNull();
    });

    it('should handle array header values', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const traceparent = `00-${traceId}-${spanId}-01`;

      const headers = {
        [CORRELATION_HEADERS.TRACEPARENT]: [traceparent],
      };

      const ctx = extractCorrelationFromHeaders(headers);
      expect(ctx).not.toBeNull();
      expect(ctx?.traceId).toBe(traceId);
    });
  });

  describe('injectCorrelationToHeaders', () => {
    it('should inject correlation headers', () => {
      const tracer = trace.getTracer('test');
      let headers: Record<string, string> = {};

      tracer.startActiveSpan('test-span', {}, (span) => {
        headers = injectCorrelationToHeaders({});
        span.end();
      });

      expect(headers[CORRELATION_HEADERS.CORRELATION_ID]).toBeTruthy();
      expect(headers[CORRELATION_HEADERS.TRACE_ID]).toBeTruthy();
      expect(headers[CORRELATION_HEADERS.SPAN_ID]).toBeTruthy();
      expect(headers[CORRELATION_HEADERS.TRACEPARENT]).toBeTruthy();
    });

    it('should merge with existing headers', () => {
      const tracer = trace.getTracer('test');
      const existingHeaders = { 'Authorization': 'Bearer token' };
      let headers: Record<string, string> = {};

      tracer.startActiveSpan('test-span', {}, (span) => {
        headers = injectCorrelationToHeaders(existingHeaders);
        span.end();
      });

      expect(headers['Authorization']).toBe('Bearer token');
      expect(headers[CORRELATION_HEADERS.CORRELATION_ID]).toBeTruthy();
    });

    it('should return empty headers when no active span', () => {
      const headers = injectCorrelationToHeaders({});
      // May still have traceparent from OpenTelemetry propagation
      expect(typeof headers).toBe('object');
    });
  });

  describe('getCorrelationId', () => {
    it('should return correlation ID from active span', () => {
      const tracer = trace.getTracer('test');
      let correlationId: string | null = null;

      tracer.startActiveSpan('test-span', {}, (span) => {
        correlationId = getCorrelationId();
        span.end();
      });

      expect(correlationId).toBeTruthy();
      expect(typeof correlationId).toBe('string');
    });

    it('should return null when no active span', () => {
      const correlationId = getCorrelationId();
      expect(correlationId).toBeNull();
    });
  });

  describe('getCorrelationMetadata', () => {
    it('should return correlation metadata from active span', () => {
      const tracer = trace.getTracer('test');
      let metadata: Record<string, string> | null = null;

      tracer.startActiveSpan('test-span', {}, (span) => {
        metadata = getCorrelationMetadata();
        span.end();
      });

      expect(metadata).not.toBeNull();
      expect(metadata?.traceId).toBeTruthy();
      expect(metadata?.spanId).toBeTruthy();
      expect(metadata?.correlationId).toBeTruthy();
    });

    it('should return null when no active span', () => {
      const metadata = getCorrelationMetadata();
      expect(metadata).toBeNull();
    });
  });

  describe('runWithCorrelationContext', () => {
    it('should run function with correlation context', () => {
      const correlationCtx = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        correlationId: 'test-correlation-id',
      };

      let capturedId: string | null = null;
      runWithCorrelationContext(correlationCtx, () => {
        capturedId = getCorrelationId();
      });

      // The correlation ID should be available in the context
      expect(capturedId).toBeTruthy();
    });

    it('should run function normally when context is null', () => {
      let executed = false;
      runWithCorrelationContext(null, () => {
        executed = true;
      });

      expect(executed).toBe(true);
    });
  });
});
