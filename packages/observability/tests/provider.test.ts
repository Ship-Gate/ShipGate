/**
 * Tests for the observability provider
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  initTracing,
  shutdownTracing,
  isTracingEnabled,
  withSpan,
  withSpanSync,
  ISL_ATTR,
} from '../src/index.js';

describe('@isl-lang/observability', () => {
  afterEach(async () => {
    await shutdownTracing();
  });

  describe('initTracing', () => {
    it('should default to disabled when no env var is set', () => {
      delete process.env['ISL_TRACE'];
      delete process.env['SHIPGATE_TRACE'];
      initTracing();
      expect(isTracingEnabled()).toBe(false);
    });

    it('should enable tracing when enabled: true is passed', () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      expect(isTracingEnabled()).toBe(true);
    });

    it('should enable tracing when ISL_TRACE=1', () => {
      process.env['ISL_TRACE'] = '1';
      initTracing({ exporter: { type: 'none' } });
      expect(isTracingEnabled()).toBe(true);
      delete process.env['ISL_TRACE'];
    });

    it('should enable tracing when SHIPGATE_TRACE=true', () => {
      process.env['SHIPGATE_TRACE'] = 'true';
      initTracing({ exporter: { type: 'none' } });
      expect(isTracingEnabled()).toBe(true);
      delete process.env['SHIPGATE_TRACE'];
    });

    it('should be idempotent — second call is a noop', () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      initTracing({ enabled: true, exporter: { type: 'console' } });
      expect(isTracingEnabled()).toBe(true);
    });
  });

  describe('shutdownTracing', () => {
    it('should disable tracing after shutdown', async () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      expect(isTracingEnabled()).toBe(true);
      await shutdownTracing();
      expect(isTracingEnabled()).toBe(false);
    });

    it('should be safe to call when tracing was never initialised', async () => {
      await shutdownTracing();
      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe('withSpan', () => {
    it('should execute the function and return its result', async () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      const result = await withSpan('test.span', {}, async () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it('should propagate errors thrown inside the span', async () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      await expect(
        withSpan('test.error', {}, async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });

    it('should pass a TracedSpan with setAttribute/addEvent', async () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      await withSpan('test.attrs', {}, async (span) => {
        span.setAttribute(ISL_ATTR.COMMAND, 'verify');
        span.addEvent('test-event', { key: 'value' });
        span.setOk();
      });
    });

    it('should work when tracing is disabled (noop tracer)', async () => {
      initTracing({ enabled: false });
      const result = await withSpan('noop.span', {}, async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should support nested spans (context propagation)', async () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      const result = await withSpan('parent', {}, async (parentSpan) => {
        parentSpan.setAttribute('level', 'parent');
        return withSpan('child', {}, async (childSpan) => {
          childSpan.setAttribute('level', 'child');
          return 'nested';
        });
      });
      expect(result).toBe('nested');
    });
  });

  describe('withSpanSync', () => {
    it('should execute synchronous functions', () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      const result = withSpanSync('sync.span', {}, () => 'sync-result');
      expect(result).toBe('sync-result');
    });

    it('should propagate synchronous errors', () => {
      initTracing({ enabled: true, exporter: { type: 'none' } });
      expect(() =>
        withSpanSync('sync.error', {}, () => {
          throw new Error('sync-boom');
        }),
      ).toThrow('sync-boom');
    });
  });

  describe('ISL_ATTR', () => {
    it('should export all expected semantic attribute keys', () => {
      expect(ISL_ATTR.COMMAND).toBe('isl.cli.command');
      expect(ISL_ATTR.VERIFY_VERDICT).toBe('isl.verify.verdict');
      expect(ISL_ATTR.VERIFY_SCORE).toBe('isl.verify.score');
      expect(ISL_ATTR.CODEGEN_TARGET).toBe('isl.codegen.target');
      expect(ISL_ATTR.DURATION_MS).toBe('isl.duration_ms');
      expect(ISL_ATTR.EXIT_CODE).toBe('isl.cli.exit_code');
      expect(ISL_ATTR.SPEC_FILE).toBe('isl.spec_file');
      expect(ISL_ATTR.IMPL_FILE).toBe('isl.impl_file');
    });
  });
});
