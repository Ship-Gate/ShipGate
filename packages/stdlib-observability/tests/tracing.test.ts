// ============================================================================
// Observability Standard Library - Tracing Tests (Fixed)
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Tracer,
  SpanKind,
  SpanStatus,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  injectContext,
  extractContext,
  PropagationFormat,
  getDefaultTracer,
  setDefaultTracer,
  B3_PARENT_SPAN_ID_HEADER,
} from '../implementations/typescript/index';

describe('Tracing', () => {
  let tracer: Tracer;
  let memoryExporter: InMemorySpanExporter;

  beforeEach(() => {
    memoryExporter = new InMemorySpanExporter();
    tracer = new Tracer({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    });
    // Add the exporter manually since it's not in the config
    (tracer as any).exporters = [memoryExporter];
  });

  describe('Span Lifecycle', () => {
    it('should start and end spans', async () => {
      const result = tracer.startSpan({
        name: 'test-operation',
        kind: SpanKind.INTERNAL,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const { span, context } = result.value;

        expect(span.name).toBe('test-operation');
        expect(span.kind).toBe(SpanKind.INTERNAL);
        expect(span.traceId).toBeDefined();
        expect(span.spanId).toBeDefined();
        expect(span.startTime).toBeDefined();
        expect(span.status).toBe(SpanStatus.UNSET);

        const endResult = tracer.endSpan({
          spanId: span.spanId,
          status: SpanStatus.OK,
        });

        expect(endResult.success).toBe(true);
        if (endResult.success) {
          const endedSpan = endResult.value;
          expect(endedSpan.endTime).toBeDefined();
          expect(endedSpan.durationMs).toBeGreaterThan(0);
          expect(endedSpan.status).toBe(SpanStatus.OK);
        }

        const exportedSpans = memoryExporter.getSpans();
        expect(exportedSpans).toHaveLength(1);
        expect(exportedSpans[0].spanId).toBe(span.spanId);
      }
    });

    it('should create parent-child relationships', async () => {
      const parentResult = tracer.startSpan({ name: 'parent' });
      expect(parentResult.success).toBe(true);
      
      if (parentResult.success) {
        const parent = parentResult.value;

        const childResult = tracer.startSpan({
          name: 'child',
          parentContext: parent.context,
        });
        expect(childResult.success).toBe(true);

        if (childResult.success) {
          const child = childResult.value;

          expect(child.span.traceId).toBe(parent.span.traceId);
          expect(child.span.parentSpanId).toBe(parent.span.spanId);

          tracer.endSpan({ spanId: child.span.spanId });
          tracer.endSpan({ spanId: parent.span.spanId });

          const exportedSpans = memoryExporter.getSpans();
          expect(exportedSpans).toHaveLength(2);
          
          const childSpan = exportedSpans.find(s => s.name === 'child');
          const parentSpan = exportedSpans.find(s => s.name === 'parent');
          
          expect(childSpan?.parentSpanId).toBe(parentSpan?.spanId);
        }
      }
    });

    it('should add events to spans', async () => {
      const result = tracer.startSpan({
        name: 'test-span',
      });
      expect(result.success).toBe(true);
      
      if (result.success) {
        const { span } = result.value;

        tracer.addSpanEvent({
          spanId: span.spanId,
          name: 'event1',
          attributes: { key: 'value' },
        });

        tracer.addSpanEvent({
          spanId: span.spanId,
          name: 'event2',
        });

        tracer.endSpan({ spanId: span.spanId });

        // Check the span in the exporter
        const exportedSpans = memoryExporter.getSpans();
        const updatedSpan = exportedSpans.find(s => s.spanId === span.spanId);
        expect(updatedSpan?.events).toHaveLength(2);
        expect(updatedSpan?.events?.[0].name).toBe('event1');
        expect(updatedSpan?.events?.[0].attributes?.key).toBe('value');
        expect(updatedSpan?.events?.[1].name).toBe('event2');
      }
    });

    it('should set attributes on spans', async () => {
      const result = tracer.startSpan({
        name: 'test-span',
        attributes: { initial: 'value' },
      });
      expect(result.success).toBe(true);
      
      if (result.success) {
        const { span } = result.value;

        tracer.setSpanAttribute({
          spanId: span.spanId,
          key: 'string',
          value: 'test',
        });

        tracer.setSpanAttribute({
          spanId: span.spanId,
          key: 'number',
          value: 42,
        });

        tracer.setSpanAttribute({
          spanId: span.spanId,
          key: 'boolean',
          value: true,
        });

        tracer.endSpan({ spanId: span.spanId });

        // Check the span in the exporter
        const exportedSpans = memoryExporter.getSpans();
        const updatedSpan = exportedSpans.find(s => s.spanId === span.spanId);
        expect(updatedSpan?.attributes?.initial).toBe('value');
        expect(updatedSpan?.attributes?.string).toBe('test');
        expect(updatedSpan?.attributes?.number).toBe(42);
        expect(updatedSpan?.attributes?.boolean).toBe(true);
      }
    });
  });

  describe('Context Propagation', () => {
    it('should inject and extract W3C trace context', () => {
      const context = {
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        traceFlags: 1,
        traceState: 'key1=value1,key2=value2',
        remote: false,
      };

      const headers = injectContext({
        context,
        carrier: {},
        format: PropagationFormat.W3C_TRACE_CONTEXT,
      });

      expect(headers['traceparent']).toBe('00-abcdef1234567890abcdef1234567890-1234567890abcdef-01');
      expect(headers['tracestate']).toBe('key1=value1,key2=value2');

      const extracted = extractContext({
        carrier: headers,
        format: PropagationFormat.W3C_TRACE_CONTEXT,
      });

      expect(extracted).toBeDefined();
      expect(extracted!.traceId).toBe(context.traceId);
      expect(extracted!.spanId).toBe(context.spanId);
      expect(extracted!.traceFlags).toBe(1);
      expect(extracted!.traceState).toBe(context.traceState);
    });

    it('should inject and extract B3 single header', () => {
      const context = {
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        traceFlags: 1,
        remote: false,
      };

      const headers = injectContext({
        context,
        carrier: {},
        format: PropagationFormat.B3_SINGLE,
      });

      expect(headers['b3']).toBe('abcdef1234567890abcdef1234567890-1234567890abcdef-1');

      const extracted = extractContext({
        carrier: headers,
        format: PropagationFormat.B3_SINGLE,
      });

      expect(extracted).toBeDefined();
      expect(extracted!.traceId).toBe(context.traceId);
      expect(extracted!.spanId).toBe(context.spanId);
      expect(extracted!.traceFlags).toBe(1);
    });

    it('should inject and extract B3 multi headers', () => {
      const context = {
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        traceFlags: 1,
        remote: false,
      };

      const headers = injectContext({
        context,
        carrier: {},
        format: PropagationFormat.B3_MULTI,
      });

      expect(headers['x-b3-traceid']).toBe('abcdef1234567890abcdef1234567890');
      expect(headers['x-b3-spanid']).toBe('1234567890abcdef');
      expect(headers['x-b3-sampled']).toBe('1');

      const extracted = extractContext({
        carrier: headers,
        format: PropagationFormat.B3_MULTI,
      });

      expect(extracted).toBeDefined();
      expect(extracted!.traceId).toBe(context.traceId);
      expect(extracted!.spanId).toBe(context.spanId);
      expect(extracted!.traceFlags).toBe(1);
    });
  });

  describe('Default Tracer', () => {
    it('should manage default tracer instance', () => {
      const originalTracer = getDefaultTracer();
      
      const newTracer = new Tracer({
        serviceName: 'new-service',
      });

      setDefaultTracer(newTracer);
      expect(getDefaultTracer()).toBe(newTracer);

      // Restore original
      setDefaultTracer(originalTracer);
    });
  });

  describe('Trace Aggregation', () => {
    it('should aggregate spans into traces', async () => {
      const rootResult = tracer.startSpan({ name: 'root' });
      expect(rootResult.success).toBe(true);
      
      if (rootResult.success) {
        const root = rootResult.value;

        const child1Result = tracer.startSpan({ 
          name: 'child1', 
          parentContext: root.context 
        });
        expect(child1Result.success).toBe(true);
        
        if (child1Result.success) {
          const child1 = child1Result.value;

          const child2Result = tracer.startSpan({ 
            name: 'child2', 
            parentContext: root.context 
          });
          expect(child2Result.success).toBe(true);
          
          if (child2Result.success) {
            const child2 = child2Result.value;

            const grandchildResult = tracer.startSpan({ 
              name: 'grandchild', 
              parentContext: child1.context 
            });
            expect(grandchildResult.success).toBe(true);
            
            if (grandchildResult.success) {
              const grandchild = grandchildResult.value;

              tracer.endSpan({ spanId: grandchild.span.spanId });
              tracer.endSpan({ spanId: child2.span.spanId });
              tracer.endSpan({ spanId: child1.span.spanId });
              tracer.endSpan({ spanId: root.span.spanId });

              const traceResult = tracer.getTrace(root.span.traceId);
              expect(traceResult).toBeDefined();
              const trace = traceResult!;
              expect(trace.traceId).toBe(root.span.traceId);
              expect(trace.spans).toHaveLength(4);
              expect(trace.spans.length).toBe(4);
            }
          }
        }
      }
    });
  });

  describe('Exporter Integration', () => {
    it('should export spans to configured exporter', async () => {
      const result = tracer.startSpan({
        name: 'test-export',
      });
      expect(result.success).toBe(true);
      
      if (result.success) {
        const { span } = result.value;

        tracer.endSpan({ spanId: span.spanId });

        const exportedSpans = memoryExporter.getSpans();
        expect(exportedSpans).toHaveLength(1);
        expect(exportedSpans[0].name).toBe('test-export');
      }
    });
  });
});
