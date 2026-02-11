// ============================================================================
// Observability Standard Library - Correlation Tests
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCorrelationContext,
  setCorrelationContext,
  withCorrelationContext,
  withoutCorrelationContext,
  generateCorrelationId,
  generateRequestId,
  startNewTrace,
  extractCorrelationFromHeaders,
  injectCorrelationIntoHeaders,
  isValidTraceId,
  isValidSpanId,
  isValidUUID,
  createCorrelationMiddleware,
} from '../implementations/typescript/correlation';

describe('Correlation', () => {
  beforeEach(() => {
    // Clear context before each test
    withoutCorrelationContext(() => {
      setCorrelationContext({});
    });
  });

  describe('Context Management', () => {
    it('should get and set correlation context', () => {
      expect(getCorrelationContext()).toEqual({});

      setCorrelationContext({ traceId: 'test-trace-id' });
      expect(getCorrelationContext()).toEqual({ traceId: 'test-trace-id' });

      setCorrelationContext({ spanId: 'test-span-id' });
      expect(getCorrelationContext()).toEqual({ 
        traceId: 'test-trace-id',
        spanId: 'test-span-id' 
      });
    });

    it('should propagate context with withCorrelationContext', () => {
      setCorrelationContext({ userId: 'user123' });

      const result = withCorrelationContext(
        { traceId: 'new-trace-id' },
        () => {
          const context = getCorrelationContext();
          return { ...context };
        }
      );

      expect(result).toEqual({
        userId: 'user123',
        traceId: 'new-trace-id',
      });

      // Original context should be preserved
      expect(getCorrelationContext()).toEqual({ userId: 'user123' });
    });

    it('should handle nested withCorrelationContext', () => {
      const outerResult = withCorrelationContext(
        { traceId: 'outer-trace' },
        () => {
          const innerResult = withCorrelationContext(
            { spanId: 'inner-span' },
            () => getCorrelationContext()
          );
          return { outer: getCorrelationContext(), inner: innerResult };
        }
      );

      expect(outerResult.outer).toEqual({ traceId: 'outer-trace' });
      expect(outerResult.inner).toEqual({ traceId: 'outer-trace', spanId: 'inner-span' });
    });

    it('should exit context with withoutCorrelationContext', () => {
      setCorrelationContext({ traceId: 'test-trace' });

      const result = withoutCorrelationContext(() => {
        return getCorrelationContext();
      });

      expect(result).toEqual({});
      expect(getCorrelationContext()).toEqual({ traceId: 'test-trace' });
    });
  });

  describe('ID Generation', () => {
    it('should generate valid correlation IDs', () => {
      const id = generateCorrelationId();
      expect(isValidUUID(id)).toBe(true);
      
      const id2 = generateCorrelationId();
      expect(id).not.toBe(id2);
    });

    it('should generate valid request IDs', () => {
      const id = generateRequestId();
      expect(isValidUUID(id)).toBe(true);
      
      const id2 = generateRequestId();
      expect(id).not.toBe(id2);
    });

    it('should start new trace with all IDs', () => {
      const context = startNewTrace();
      
      expect(context).toHaveProperty('traceId');
      expect(context).toHaveProperty('spanId');
      expect(context).toHaveProperty('correlationId');
      expect(context).toHaveProperty('requestId');
      
      expect(isValidTraceId(context.traceId!)).toBe(true);
      expect(isValidSpanId(context.spanId!)).toBe(true);
      expect(isValidUUID(context.correlationId!)).toBe(true);
      expect(isValidUUID(context.requestId!)).toBe(true);
    });
  });

  describe('Header Injection/Extraction', () => {
    it('should extract correlation context from headers', () => {
      const headers = {
        'x-trace-id': 'abcdef1234567890abcdef1234567890',
        'x-span-id': '1234567890abcdef',
        'x-correlation-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440001',
        'x-user-id': 'user123',
        'x-session-id': 'session456',
        'x-tenant-id': 'tenant789',
        'x-version': '1.0.0',
      };

      const context = extractCorrelationFromHeaders(headers);

      expect(context).toEqual({
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user123',
        sessionId: 'session456',
        tenantId: 'tenant789',
        version: '1.0.0',
      });
    });

    it('should inject correlation context into headers', () => {
      const context = {
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user123',
        sessionId: 'session456',
        tenantId: 'tenant789',
        version: '1.0.0',
      };

      const headers = injectCorrelationIntoHeaders(context);

      expect(headers).toEqual({
        'x-trace-id': 'abcdef1234567890abcdef1234567890',
        'x-span-id': '1234567890abcdef',
        'x-correlation-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440001',
        'x-user-id': 'user123',
        'x-session-id': 'session456',
        'x-tenant-id': 'tenant789',
        'x-version': '1.0.0',
      });
    });

    it('should handle empty context in header injection', () => {
      const headers = injectCorrelationIntoHeaders({});
      expect(headers).toEqual({});
    });

    it('should handle round-trip header injection/extraction', () => {
      const originalContext = {
        traceId: 'abcdef1234567890abcdef1234567890',
        spanId: '1234567890abcdef',
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
      };

      const headers = injectCorrelationIntoHeaders(originalContext);
      const extractedContext = extractCorrelationFromHeaders(headers);

      expect(extractedContext).toEqual(originalContext);
    });
  });

  describe('Validation', () => {
    it('should validate trace IDs', () => {
      expect(isValidTraceId('abcdef1234567890abcdef1234567890')).toBe(true);
      expect(isValidTraceId('ABCDEF1234567890ABCDEF1234567890')).toBe(true);
      expect(isValidTraceId('abcdef1234567890')).toBe(false); // Too short
      expect(isValidTraceId('g123456789012345678901234567890')).toBe(false); // Invalid hex
      expect(isValidTraceId('')).toBe(false);
    });

    it('should validate span IDs', () => {
      expect(isValidSpanId('1234567890abcdef')).toBe(true);
      expect(isValidSpanId('1234567890ABCDEF')).toBe(true);
      expect(isValidSpanId('12345678')).toBe(false); // Too short
      expect(isValidSpanId('g1234567890abcd')).toBe(false); // Invalid hex
      expect(isValidSpanId('')).toBe(false);
    });

    it('should validate UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544')).toBe(false); // Too short
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440001')).toBe(false); // Invalid version
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('Middleware', () => {
    it('should create correlation middleware', async () => {
      const middleware = createCorrelationMiddleware();
      
      const mockNext = vi.fn().mockResolvedValue('result');
      const result = await middleware({ test: 'input' }, mockNext);

      expect(result).toBe('result');
      expect(mockNext).toHaveBeenCalledWith({ test: 'input' });
    });

    it('should extract context using custom extractor', async () => {
      const extractor = (input: any) => ({
        traceId: input.headers?.['x-trace-id'],
        userId: input.user?.id,
      });

      const middleware = createCorrelationMiddleware(extractor);
      
      const input = {
        headers: { 'x-trace-id': 'custom-trace-id' },
        user: { id: 'user123' },
      };
      
      let capturedContext: any = null;
      const mockNext = vi.fn().mockImplementation(async () => {
        capturedContext = getCorrelationContext();
        return 'result';
      });

      await middleware(input, mockNext);

      expect(capturedContext.traceId).toBe('custom-trace-id');
      expect(capturedContext.userId).toBe('user123');
      expect(capturedContext.correlationId).toBeDefined();
      expect(capturedContext.requestId).toBeDefined();
    });

    it('should generate new IDs when not provided', async () => {
      const middleware = createCorrelationMiddleware();
      
      let capturedContext: any = null;
      const mockNext = vi.fn().mockImplementation(async () => {
        capturedContext = getCorrelationContext();
        return 'result';
      });

      await middleware({}, mockNext);

      expect(isValidTraceId(capturedContext.traceId!)).toBe(true);
      expect(isValidSpanId(capturedContext.spanId!)).toBe(true);
      expect(isValidUUID(capturedContext.correlationId!)).toBe(true);
      expect(isValidUUID(capturedContext.requestId!)).toBe(true);
    });
  });

  describe('Async Context Propagation', () => {
    it('should propagate context through async operations', async () => {
      const context = { traceId: 'async-trace' };
      
      const result = await withCorrelationContext(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return getCorrelationContext();
      });

      expect(result.traceId).toBe('async-trace');
    });

    it('should handle multiple concurrent operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const promise = withCorrelationContext(
          { traceId: `trace-${i}` },
          async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return getCorrelationContext();
          }
        );
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      
      for (let i = 0; i < 5; i++) {
        expect(results[i].traceId).toBe(`trace-${i}`);
      }
    });
  });
});
