/**
 * Tests for Chaos Injectors
 * 
 * Verifies that injections actually occurred (not just "ran successfully").
 * These tests confirm measurable faults are injected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NetworkInjector } from '../src/injectors/network.js';
import { ClockSkewInjector, SystemTimeProvider } from '../src/injectors/clock-skew.js';
import { ConcurrentInjector } from '../src/injectors/concurrent.js';
import { LatencyInjector } from '../src/injectors/latency.js';
import { createTimeline } from '../src/timeline.js';

describe('Network Injector', () => {
  let injector: NetworkInjector;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    injector = new NetworkInjector({
      failureType: 'latency',
      latencyMs: 100,
      probability: 1.0,
    });
    const timeline = createTimeline();
    injector.attachTimeline(timeline);
  });

  afterEach(() => {
    injector.deactivate();
    globalThis.fetch = originalFetch;
  });

  it('should intercept HTTP requests', async () => {
    injector.activate();
    
    const mockFetch = async () => new Response('OK');
    globalThis.fetch = mockFetch as typeof fetch;

    const startTime = Date.now();
    await injector['createInterceptedFetch']().call(globalThis, 'http://example.com');
    const duration = Date.now() - startTime;

    const state = injector.getState();
    expect(state.interceptedRequests).toBeGreaterThan(0);
    expect(duration).toBeGreaterThanOrEqual(90); // Should have latency injected
  });

  it('should inject latency measurably', async () => {
    injector = new NetworkInjector({
      failureType: 'latency',
      latencyMs: 200,
      probability: 1.0,
    });
    injector.activate();

    const mockFetch = async () => new Response('OK');
    globalThis.fetch = mockFetch as typeof fetch;

    const startTime = Date.now();
    await injector['createInterceptedFetch']().call(globalThis, 'http://example.com');
    const duration = Date.now() - startTime;

    const state = injector.getState();
    expect(state.latencyInjections).toBeGreaterThan(0);
    expect(state.totalLatencyInjected).toBeGreaterThan(0);
    expect(duration).toBeGreaterThanOrEqual(180); // At least 200ms - some tolerance
  });

  it('should inject network failures', async () => {
    injector = new NetworkInjector({
      failureType: 'connection_refused',
      probability: 1.0,
    });
    injector.activate();

    const mockFetch = async () => new Response('OK');
    globalThis.fetch = mockFetch as typeof fetch;

    try {
      await injector['createInterceptedFetch']().call(globalThis, 'http://example.com');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Connection refused');
    }

    const state = injector.getState();
    expect(state.failedRequests).toBeGreaterThan(0);
  });
});

describe('Clock Skew Injector', () => {
  let injector: ClockSkewInjector;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
  });

  afterEach(() => {
    injector.deactivate();
    Date.now = originalDateNow;
  });

  it('should inject clock skew measurably', () => {
    injector = new ClockSkewInjector({
      offsetMs: 5000,
      mode: 'fixed',
    });
    injector.activate();

    const realTime = originalDateNow.call(Date);
    const skewedTime = Date.now();
    const offset = skewedTime - realTime;

    expect(offset).toBeGreaterThanOrEqual(4900); // Allow some tolerance
    expect(offset).toBeLessThanOrEqual(5100);

    const state = injector.getState();
    expect(state.dateNowCallCount).toBeGreaterThan(0);
    expect(Math.abs(state.currentOffsetMs)).toBeGreaterThanOrEqual(4900);
  });

  it('should support time provider dependency injection', () => {
    let callCount = 0;
    const mockProvider = {
      now: () => {
        callCount++;
        return 1000 + callCount * 100;
      },
      createDate: () => new Date(),
    };

    injector = new ClockSkewInjector({
      offsetMs: 1000,
      mode: 'fixed',
      timeProvider: mockProvider,
    });

    expect(injector.getTimeProvider()).toBe(mockProvider);
    injector.activate();

    const state = injector.getState();
    expect(state.active).toBe(true);
  });
});

describe('Concurrent Injector', () => {
  let injector: ConcurrentInjector;

  beforeEach(() => {
    injector = new ConcurrentInjector({
      concurrency: 5,
      staggered: false,
    });
    const timeline = createTimeline();
    injector.attachTimeline(timeline);
  });

  afterEach(() => {
    injector.deactivate();
  });

  it('should execute operations concurrently', async () => {
    injector.activate();

    const delays: number[] = [];
    const operation = async (index: number) => {
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50));
      delays.push(Date.now() - start);
      return { index, completed: true };
    };

    const results = await injector.execute(operation);

    expect(results.length).toBe(5);
    expect(results.every(r => r.success)).toBe(true);
    
    // All should complete around the same time (concurrent execution)
    const maxDelay = Math.max(...delays);
    const minDelay = Math.min(...delays);
    expect(maxDelay - minDelay).toBeLessThan(100); // Should be concurrent

    const state = injector.getState();
    expect(state.totalRequests).toBe(5);
    expect(state.successfulRequests).toBe(5);
  });

  it('should inject jitter in staggered execution', async () => {
    injector = new ConcurrentInjector({
      concurrency: 3,
      staggered: true,
      staggerDelayMs: 100,
      staggerJitterMs: 50,
    });
    injector.activate();

    const timestamps: number[] = [];
    const operation = async (index: number) => {
      timestamps.push(Date.now());
      return { index };
    };

    await injector.execute(operation);

    // Check that requests were staggered with jitter
    expect(timestamps.length).toBe(3);
    const delays = timestamps.slice(1).map((t, i) => t - timestamps[i]!);
    
    // Delays should vary due to jitter (not exactly 100ms)
    delays.forEach(delay => {
      expect(delay).toBeGreaterThan(50); // At least 100ms - 50ms jitter
      expect(delay).toBeLessThan(200); // At most 100ms + 50ms jitter + some tolerance
    });
  });

  it('should enforce max concurrency limit', async () => {
    injector = new ConcurrentInjector({
      concurrency: 10,
      maxConcurrency: 3,
      enforceLimit: true,
    });
    injector.activate();

    let concurrentCount = 0;
    let maxConcurrent = 0;
    const operation = async (index: number) => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await new Promise(resolve => setTimeout(resolve, 10));
      concurrentCount--;
      return { index };
    };

    await injector.execute(operation);

    // Should not exceed max concurrency
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});

describe('Latency Injector', () => {
  let injector: LatencyInjector;

  beforeEach(() => {
    injector = new LatencyInjector({
      latencyMs: 100,
      distribution: 'fixed',
      probability: 1.0,
    });
    const timeline = createTimeline();
    injector.attachTimeline(timeline);
  });

  afterEach(() => {
    injector.deactivate();
  });

  it('should inject latency measurably', async () => {
    injector.activate();

    const operation = async () => {
      return { result: 'success' };
    };

    const startTime = Date.now();
    await injector.inject(operation);
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(90); // At least 100ms - tolerance

    const state = injector.getState();
    expect(state.operationsDelayed).toBeGreaterThan(0);
    expect(state.totalLatencyAdded).toBeGreaterThan(0);
    expect(state.averageLatency).toBeGreaterThan(0);
  });

  it('should track latency statistics', async () => {
    injector.activate();

    for (let i = 0; i < 5; i++) {
      await injector.inject(async () => ({ i }));
    }

    const state = injector.getState();
    expect(state.operationsDelayed).toBe(5);
    expect(state.totalLatencyAdded).toBeGreaterThan(400); // 5 * ~100ms
    expect(state.averageLatency).toBeGreaterThan(80);
  });
});

describe('Injection Verification', () => {
  it('should verify HTTP latency injection occurred', async () => {
    const injector = new NetworkInjector({
      failureType: 'latency',
      latencyMs: 150,
      probability: 1.0,
    });
    injector.activate();

    const originalFetch = globalThis.fetch;
    let intercepted = false;
    globalThis.fetch = async () => {
      intercepted = true;
      return new Response('OK');
    } as typeof fetch;

    const startTime = Date.now();
    await injector['createInterceptedFetch']().call(globalThis, 'http://test.com');
    const duration = Date.now() - startTime;

    const state = injector.getState();
    
    // Verify injection occurred
    expect(state.interceptedRequests).toBeGreaterThan(0);
    expect(state.latencyInjections).toBeGreaterThan(0);
    expect(state.totalLatencyInjected).toBeGreaterThan(0);
    expect(duration).toBeGreaterThanOrEqual(140); // Measurable latency

    injector.deactivate();
    globalThis.fetch = originalFetch;
  });

  it('should verify clock skew injection occurred', () => {
    const injector = new ClockSkewInjector({
      offsetMs: 3000,
      mode: 'fixed',
    });
    
    const beforeActivation = Date.now();
    injector.activate();
    const afterActivation = Date.now();
    
    const state = injector.getState();
    
    // Verify injection occurred
    expect(state.active).toBe(true);
    expect(state.dateNowCallCount).toBeGreaterThan(0);
    expect(Math.abs(state.currentOffsetMs)).toBeGreaterThanOrEqual(2900);
    
    injector.deactivate();
  });

  it('should verify concurrency injection occurred', async () => {
    const injector = new ConcurrentInjector({
      concurrency: 4,
    });
    injector.activate();

    const startTimes: number[] = [];
    const operation = async (index: number) => {
      startTimes.push(Date.now());
      await new Promise(resolve => setTimeout(resolve, 20));
      return { index };
    };

    await injector.execute(operation);

    const state = injector.getState();
    
    // Verify injection occurred
    expect(state.totalRequests).toBe(4);
    expect(state.successfulRequests).toBe(4);
    
    // Verify concurrent execution (all started within small window)
    const timeSpread = Math.max(...startTimes) - Math.min(...startTimes);
    expect(timeSpread).toBeLessThan(50); // Should be concurrent

    injector.deactivate();
  });
});
