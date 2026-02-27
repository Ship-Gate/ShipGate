/**
 * ISL Runtime SDK Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sampler, createSampler, createAdaptiveSampler } from '../src/sampling/sampler.js';
import { shadowMode, type ShadowDifference } from '../src/shadow/mode.js';
import { comparator } from '../src/shadow/compare.js';
import { ISLMonitor } from '../src/monitoring/metrics.js';
import { verify } from '../src/verify.js';

describe('Sampler', () => {
  describe('random sampling', () => {
    it('should sample at approximately the correct rate', () => {
      const sampler = createSampler(0.5);
      let sampled = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        if (sampler.shouldSample()) {
          sampled++;
        }
      }

      const rate = sampled / iterations;
      expect(rate).toBeGreaterThan(0.45);
      expect(rate).toBeLessThan(0.55);
    });

    it('should sample all when rate is 1.0', () => {
      const sampler = createSampler(1.0);
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(true);
      }
    });

    it('should sample none when rate is 0', () => {
      const sampler = createSampler(0);
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(false);
      }
    });
  });

  describe('deterministic sampling', () => {
    it('should return consistent results for the same key', () => {
      const sampler = new Sampler({ rate: 0.5, strategy: 'deterministic', seed: 'test' });
      
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(sampler.shouldSample('user-123'));
      }

      // All results should be the same for the same key
      expect(new Set(results).size).toBe(1);
    });
  });
});

describe('Shadow Mode', () => {
  it('should execute primary and return result', async () => {
    const primary = vi.fn().mockResolvedValue({ id: 1, name: 'test' });
    const shadow = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

    const executor = shadowMode({
      primary,
      shadow,
      sampling: 1.0,
    });

    const result = await executor.execute('arg1');

    expect(result.result).toEqual({ id: 1, name: 'test' });
    expect(primary).toHaveBeenCalledWith('arg1');
  });

  it('should execute shadow when sampled', async () => {
    const primary = vi.fn().mockResolvedValue({ id: 1 });
    const shadow = vi.fn().mockResolvedValue({ id: 1 });

    const executor = shadowMode({
      primary,
      shadow,
      sampling: 1.0,
    });

    await executor.execute('arg1');

    expect(shadow).toHaveBeenCalledWith('arg1');
  });

  it('should detect differences', async () => {
    const primary = vi.fn().mockResolvedValue({ id: 1, name: 'old' });
    const shadow = vi.fn().mockResolvedValue({ id: 1, name: 'new' });
    const onDifference = vi.fn();

    const executor = shadowMode({
      primary,
      shadow,
      sampling: 1.0,
      onDifference,
    });

    const result = await executor.execute('arg1');

    expect(result.shadowMatch).toBe(false);
    expect(onDifference).toHaveBeenCalled();
  });

  it('should track stats', async () => {
    const primary = vi.fn().mockResolvedValue({ id: 1 });
    const shadow = vi.fn().mockResolvedValue({ id: 1 });

    const executor = shadowMode({
      primary,
      shadow,
      sampling: 1.0,
    });

    await executor.execute('arg1');
    await executor.execute('arg2');

    const stats = executor.getStats();
    expect(stats.totalExecutions).toBe(2);
    expect(stats.shadowExecutions).toBe(2);
    expect(stats.matches).toBe(2);
    expect(stats.mismatches).toBe(0);
  });

  it('should handle shadow errors', async () => {
    const primary = vi.fn().mockResolvedValue({ id: 1 });
    const shadow = vi.fn().mockRejectedValue(new Error('Shadow error'));
    const onShadowError = vi.fn();

    const executor = shadowMode({
      primary,
      shadow,
      sampling: 1.0,
      onShadowError,
    });

    const result = await executor.execute('arg1');

    expect(result.result).toEqual({ id: 1 });
    expect(result.shadowError).toBeDefined();
    expect(onShadowError).toHaveBeenCalled();
  });
});

describe('Comparator', () => {
  describe('deepEqual', () => {
    it('should detect equal objects', () => {
      const result = comparator.deepEqual(
        { a: 1, b: { c: 2 } },
        { a: 1, b: { c: 2 } }
      );

      expect(result.equal).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect value differences', () => {
      const result = comparator.deepEqual(
        { a: 1 },
        { a: 2 }
      );

      expect(result.equal).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0]!.type).toBe('value_mismatch');
    });

    it('should detect missing keys', () => {
      const result = comparator.deepEqual(
        { a: 1, b: 2 },
        { a: 1 }
      );

      expect(result.equal).toBe(false);
      expect(result.differences.some(d => d.type === 'missing')).toBe(true);
    });

    it('should detect extra keys', () => {
      const result = comparator.deepEqual(
        { a: 1 },
        { a: 1, b: 2 }
      );

      expect(result.equal).toBe(false);
      expect(result.differences.some(d => d.type === 'extra')).toBe(true);
    });

    it('should compare arrays', () => {
      const result = comparator.deepEqual(
        { arr: [1, 2, 3] },
        { arr: [1, 2, 3] }
      );

      expect(result.equal).toBe(true);
    });
  });

  describe('ignoring', () => {
    it('should ignore specified paths', () => {
      const compare = comparator.ignoring('timestamp', 'meta.*');
      
      const result = compare(
        { id: 1, timestamp: 123, meta: { updated: true } },
        { id: 1, timestamp: 456, meta: { updated: false } }
      );

      expect(result.equal).toBe(true);
    });
  });

  describe('withTolerance', () => {
    it('should allow numeric tolerance', () => {
      const compare = comparator.withTolerance(0.01);
      
      const result = compare(
        { value: 1.005 },
        { value: 1.006 }
      );

      expect(result.equal).toBe(true);
    });
  });
});

describe('ISLMonitor', () => {
  it('should track precondition checks', () => {
    const monitor = new ISLMonitor({
      spec: 'test.isl',
    });

    monitor.start();
    monitor.recordCheck('precondition', 'auth', 'Login', true);
    monitor.recordCheck('precondition', 'auth', 'Login', true);
    monitor.recordCheck('precondition', 'auth', 'Login', false);

    const stats = monitor.getStats();
    expect(stats.preconditions.total).toBe(3);
    expect(stats.preconditions.passed).toBe(2);
    expect(stats.preconditions.failed).toBe(1);
    expect(stats.preconditions.passRate).toBeCloseTo(2 / 3);
  });

  it('should track postcondition checks', () => {
    const monitor = new ISLMonitor({
      spec: 'test.isl',
    });

    monitor.start();
    monitor.recordCheck('postcondition', 'auth', 'Login', true, 100);
    monitor.recordCheck('postcondition', 'auth', 'Login', true, 150);

    const stats = monitor.getStats();
    expect(stats.postconditions.total).toBe(2);
    expect(stats.postconditions.passed).toBe(2);
    expect(stats.postconditions.passRate).toBe(1);
  });

  it('should track latency percentiles', () => {
    const monitor = new ISLMonitor({
      spec: 'test.isl',
    });

    monitor.start();
    
    // Add many latency samples
    for (let i = 1; i <= 100; i++) {
      monitor.recordCheck('postcondition', 'auth', 'Login', true, i);
    }

    const stats = monitor.getStats();
    expect(stats.latency.p50).toBeGreaterThan(0);
    expect(stats.latency.p95).toBeGreaterThan(stats.latency.p50);
    expect(stats.latency.p99).toBeGreaterThan(stats.latency.p95);
  });

  it('should generate Prometheus metrics', () => {
    const monitor = new ISLMonitor({
      spec: 'test.isl',
      metrics: { provider: 'prometheus', prefix: 'test_' },
    });

    monitor.start();
    monitor.recordCheck('precondition', 'auth', 'Login', true);
    monitor.recordCheck('precondition', 'auth', 'Login', false);

    const metrics = monitor.getPrometheusMetrics();
    expect(metrics).toContain('test_precondition_checks_total');
    expect(metrics).toContain('result="pass"');
    expect(metrics).toContain('result="fail"');
  });

  it('should call violation handlers', () => {
    const monitor = new ISLMonitor({
      spec: 'test.isl',
    });

    const handler = vi.fn();
    monitor.onViolation(handler);
    monitor.start();

    monitor.recordViolation({
      type: 'precondition',
      domain: 'auth',
      behavior: 'Login',
      condition: 'email.is_valid',
      message: 'Invalid email',
      timestamp: new Date(),
    });

    expect(handler).toHaveBeenCalled();
  });
});

describe('verify helper', () => {
  it('should wrap function with verification', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com' });
    
    const wrapped = verify('CreateUser', fn);
    const result = await wrapped({ email: 'test@example.com' });

    expect(result).toEqual({ id: 1, email: 'test@example.com' });
    expect(fn).toHaveBeenCalled();
  });

  it('should support chainable preconditions', async () => {
    const fn = vi.fn().mockResolvedValue({ success: true });
    const onViolation = vi.fn();

    const wrapped = verify('Test', fn, { onViolation })
      .pre((input: { value: number }) => input.value > 0);

    // Should pass
    await wrapped({ value: 5 });
    expect(onViolation).not.toHaveBeenCalled();

    // Should fail
    await wrapped({ value: -1 });
    expect(onViolation).toHaveBeenCalled();
  });

  it('should support chainable postconditions', async () => {
    const fn = vi.fn().mockResolvedValue({ status: 'pending' });
    const onViolation = vi.fn();

    const wrapped = verify('Test', fn, { onViolation })
      .post((result: { status: string }) => result.status === 'active');

    await wrapped({});
    expect(onViolation).toHaveBeenCalled();
  });
});
