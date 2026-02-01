/**
 * Tests for the Temporal Verifier
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Main verifier
  verify,
  checkEventually,
  checkWithin,
  checkAlways,
  formatVerifyResult,
  
  // Property checkers
  eventually,
  eventuallyWithin,
  eventuallyAll,
  eventuallyAny,
  within,
  withinMultiple,
  always,
  alwaysFor,
  alwaysN,
  alwaysAll,
  
  // Timing
  measureAsync,
  collectSamples,
  toMilliseconds,
  formatDuration,
  sleep,
  
  // Percentiles
  calculatePercentile,
  calculateLatencyStats,
  meetsLatencyThreshold,
  
  // Histogram
  createHistogram,
  createLatencyHistogram,
} from '../src/index.js';

// ============================================================================
// EVENTUALLY TESTS
// ============================================================================

describe('eventually', () => {
  it('should succeed when condition becomes true immediately', async () => {
    const result = await eventually(() => true);
    
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.duration).toBeLessThan(100);
  });
  
  it('should succeed when condition becomes true after a delay', async () => {
    let counter = 0;
    const result = await eventually(
      () => {
        counter++;
        return counter >= 3;
      },
      { timeout: 1000, interval: 50 }
    );
    
    expect(result.success).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(3);
  });
  
  it('should fail when condition never becomes true', async () => {
    const result = await eventually(
      () => false,
      { timeout: 200, interval: 50 }
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('did not become true');
  });
  
  it('should handle async predicates', async () => {
    const result = await eventually(
      async () => {
        await sleep(10);
        return true;
      },
      { timeout: 1000 }
    );
    
    expect(result.success).toBe(true);
  });
  
  it('should handle throwing predicates', async () => {
    const result = await eventually(
      () => { throw new Error('test error'); },
      { timeout: 200, interval: 50 }
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('test error');
  });
});

describe('eventuallyWithin', () => {
  it('should accept duration with units', async () => {
    const result = await eventuallyWithin(
      () => true,
      500,
      'ms'
    );
    
    expect(result.success).toBe(true);
  });
  
  it('should convert seconds to milliseconds', async () => {
    let called = false;
    const result = await eventuallyWithin(
      () => {
        called = true;
        return true;
      },
      1,
      'seconds'
    );
    
    expect(result.success).toBe(true);
    expect(called).toBe(true);
  });
});

describe('eventuallyAll', () => {
  it('should succeed when all conditions become true', async () => {
    const result = await eventuallyAll([
      { predicate: () => true, description: 'cond1' },
      { predicate: () => true, description: 'cond2' },
    ]);
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.success)).toBe(true);
  });
  
  it('should fail if any condition fails', async () => {
    const result = await eventuallyAll(
      [
        { predicate: () => true, description: 'cond1' },
        { predicate: () => false, description: 'cond2' },
      ],
      { timeout: 100 }
    );
    
    expect(result.success).toBe(false);
  });
});

describe('eventuallyAny', () => {
  it('should succeed when any condition becomes true', async () => {
    const result = await eventuallyAny([
      { predicate: () => false, description: 'cond1' },
      { predicate: () => true, description: 'cond2' },
    ]);
    
    expect(result.success).toBe(true);
    expect(result.successIndex).toBe(1);
  });
});

// ============================================================================
// WITHIN TESTS
// ============================================================================

describe('within', () => {
  it('should pass when latency is under threshold', async () => {
    const result = await within(
      async () => {
        await sleep(5);
        return 'done';
      },
      100,
      { sampleCount: 10, warmupRuns: 2 }
    );
    
    expect(result.success).toBe(true);
    expect(result.actualLatency).toBeLessThan(100);
  });
  
  it('should fail when latency exceeds threshold', async () => {
    const result = await within(
      async () => {
        await sleep(50);
        return 'done';
      },
      10,
      { sampleCount: 10, warmupRuns: 0 }
    );
    
    expect(result.success).toBe(false);
    expect(result.actualLatency).toBeGreaterThan(10);
  });
  
  it('should calculate percentile correctly', async () => {
    const result = await within(
      async () => 'fast',
      1000,
      { sampleCount: 50, percentile: 95 }
    );
    
    expect(result.percentile).toBe(95);
    expect(result.stats).toBeDefined();
    expect(result.stats.p95).toBeDefined();
  });
  
  it('should include histogram', async () => {
    const result = await within(
      async () => 'done',
      1000,
      { sampleCount: 20 }
    );
    
    expect(result.histogram).toBeDefined();
    expect(result.histogram.totalCount).toBe(20);
  });
});

describe('withinMultiple', () => {
  it('should check multiple percentiles', async () => {
    const result = await withinMultiple(
      async () => {
        await sleep(5);
        return 'done';
      },
      [
        { percentile: 50, maxLatencyMs: 500 },
        { percentile: 99, maxLatencyMs: 500 },
      ],
      { sampleCount: 20 }
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
  });
});

// ============================================================================
// ALWAYS TESTS
// ============================================================================

describe('always', () => {
  it('should succeed when condition is always true', async () => {
    const result = await always(
      () => true,
      { duration: 100, interval: 20 }
    );
    
    expect(result.success).toBe(true);
    expect(result.checkCount).toBeGreaterThan(0);
    expect(result.successfulChecks).toBe(result.checkCount);
  });
  
  it('should fail immediately when condition becomes false', async () => {
    let counter = 0;
    const result = await always(
      () => {
        counter++;
        return counter < 3;
      },
      { duration: 1000, interval: 20 }
    );
    
    expect(result.success).toBe(false);
    expect(result.firstViolationCheck).toBe(3);
    expect(result.checkCount).toBe(3);
  });
  
  it('should fail on throwing predicates', async () => {
    let counter = 0;
    const result = await always(
      () => {
        counter++;
        if (counter === 2) throw new Error('boom');
        return true;
      },
      { duration: 1000, interval: 20 }
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });
});

describe('alwaysFor', () => {
  it('should accept duration with units', async () => {
    const result = await alwaysFor(
      () => true,
      100,
      'ms'
    );
    
    expect(result.success).toBe(true);
  });
});

describe('alwaysN', () => {
  it('should check N times', async () => {
    const result = await alwaysN(
      () => true,
      10
    );
    
    expect(result.success).toBe(true);
    expect(result.checkCount).toBe(10);
  });
  
  it('should fail if any check fails', async () => {
    let counter = 0;
    const result = await alwaysN(
      () => {
        counter++;
        return counter < 5;
      },
      10
    );
    
    expect(result.success).toBe(false);
    expect(result.checkCount).toBe(5);
  });
});

describe('alwaysAll', () => {
  it('should check multiple invariants', async () => {
    const result = await alwaysAll(
      [
        { predicate: () => true, description: 'inv1' },
        { predicate: () => true, description: 'inv2' },
      ],
      { duration: 50 }
    );
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
  });
});

// ============================================================================
// TIMING TESTS
// ============================================================================

describe('measureAsync', () => {
  it('should measure execution time', async () => {
    const result = await measureAsync(async () => {
      await sleep(50);
      return 'done';
    });
    
    expect(result.duration).toBeGreaterThanOrEqual(45);
    expect(result.result).toBe('done');
  });
});

describe('collectSamples', () => {
  it('should collect multiple samples', async () => {
    const samples = await collectSamples(
      async () => {
        await sleep(5);
        return 'ok';
      },
      10
    );
    
    expect(samples).toHaveLength(10);
    expect(samples.every(s => s.success)).toBe(true);
  });
  
  it('should capture errors', async () => {
    let counter = 0;
    const samples = await collectSamples(
      async () => {
        counter++;
        if (counter === 5) throw new Error('fail');
        return 'ok';
      },
      10
    );
    
    expect(samples).toHaveLength(10);
    expect(samples[4]?.success).toBe(false);
    expect(samples[4]?.error?.message).toBe('fail');
  });
});

describe('toMilliseconds', () => {
  it('should convert various units', () => {
    expect(toMilliseconds(1, 'ms')).toBe(1);
    expect(toMilliseconds(1, 'seconds')).toBe(1000);
    expect(toMilliseconds(1, 'minutes')).toBe(60000);
    expect(toMilliseconds(1, 'hours')).toBe(3600000);
    expect(toMilliseconds(1, 'days')).toBe(86400000);
  });
});

describe('formatDuration', () => {
  it('should format various durations', () => {
    expect(formatDuration(0.5)).toContain('μs');
    expect(formatDuration(100)).toContain('ms');
    expect(formatDuration(5000)).toContain('s');
    expect(formatDuration(120000)).toContain('m');
  });
});

// ============================================================================
// PERCENTILE TESTS
// ============================================================================

describe('calculatePercentile', () => {
  it('should calculate correct percentiles', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    expect(calculatePercentile(values, 0)).toBe(1);
    expect(calculatePercentile(values, 50)).toBeCloseTo(5.5, 1);
    expect(calculatePercentile(values, 100)).toBe(10);
  });
  
  it('should handle empty arrays', () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });
});

describe('calculateLatencyStats', () => {
  it('should calculate comprehensive stats', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      duration: i + 1,
      success: true,
    }));
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(100);
    expect(stats.mean).toBeCloseTo(50.5, 1);
    expect(stats.count).toBe(100);
    expect(stats.successCount).toBe(100);
  });
  
  it('should handle failed samples', () => {
    const samples = [
      { duration: 10, success: true },
      { duration: 20, success: false, error: new Error('fail') },
      { duration: 30, success: true },
    ];
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.count).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.failureCount).toBe(1);
  });
});

describe('meetsLatencyThreshold', () => {
  it('should check threshold correctly', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      duration: i + 1,
      success: true,
    }));
    
    const result1 = meetsLatencyThreshold(samples, 99, 100);
    expect(result1.meets).toBe(true);
    
    const result2 = meetsLatencyThreshold(samples, 99, 50);
    expect(result2.meets).toBe(false);
  });
});

// ============================================================================
// HISTOGRAM TESTS
// ============================================================================

describe('createHistogram', () => {
  it('should create histogram with buckets', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      duration: i + 1,
      success: true,
    }));
    
    const histogram = createHistogram(samples, { bucketCount: 10 });
    
    expect(histogram.totalCount).toBe(100);
    expect(histogram.buckets.length).toBeGreaterThan(0);
  });
  
  it('should handle empty samples', () => {
    const histogram = createHistogram([]);
    
    expect(histogram.totalCount).toBe(0);
    expect(histogram.buckets).toHaveLength(0);
  });
});

describe('createLatencyHistogram', () => {
  it('should use default latency boundaries', () => {
    const samples = Array.from({ length: 50 }, () => ({
      duration: Math.random() * 100,
      success: true,
    }));
    
    const histogram = createLatencyHistogram(samples);
    
    expect(histogram.totalCount).toBe(50);
    expect(histogram.buckets.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('checkEventually', () => {
  it('should provide simple API', async () => {
    const result = await checkEventually(() => true);
    
    expect(result.success).toBe(true);
    expect(result.duration).toBeDefined();
  });
});

describe('checkWithin', () => {
  it('should provide simple API', async () => {
    const result = await checkWithin(
      async () => 'ok',
      1000,
      99,
      10
    );
    
    expect(result.success).toBe(true);
    expect(result.actualLatency).toBeDefined();
  });
});

describe('checkAlways', () => {
  it('should provide simple API', async () => {
    const result = await checkAlways(
      () => true,
      50
    );
    
    expect(result.success).toBe(true);
    expect(result.checkCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// MAIN VERIFIER TESTS
// ============================================================================

describe('verify', () => {
  const mockDomain = {
    kind: 'Domain' as const,
    name: { kind: 'Identifier' as const, name: 'TestDomain', location: {} as never },
    version: { kind: 'StringLiteral' as const, value: '1.0.0', location: {} as never },
    imports: [],
    types: [],
    entities: [],
    behaviors: [
      {
        kind: 'Behavior' as const,
        name: { kind: 'Identifier' as const, name: 'TestBehavior', location: {} as never },
        input: { kind: 'InputSpec' as const, fields: [], location: {} as never },
        output: { 
          kind: 'OutputSpec' as const, 
          success: { kind: 'PrimitiveType' as const, name: 'Boolean' as const, location: {} as never },
          errors: [],
          location: {} as never,
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        temporal: [
          {
            kind: 'TemporalSpec' as const,
            operator: 'eventually' as const,
            predicate: { kind: 'BooleanLiteral' as const, value: true, location: {} as never },
            duration: { kind: 'DurationLiteral' as const, value: 5, unit: 'seconds' as const, location: {} as never },
            location: {} as never,
          },
        ],
        security: [],
        compliance: [],
        location: {} as never,
      },
    ],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: {} as never,
  };
  
  it('should verify behavior with temporal specs', async () => {
    const result = await verify('./impl.ts', mockDomain, 'TestBehavior');
    
    expect(result.verdict).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.summary).toBeDefined();
  });
  
  it('should fail for non-existent behavior', async () => {
    const result = await verify('./impl.ts', mockDomain, 'NonExistent');
    
    expect(result.success).toBe(false);
    expect(result.verdict).toBe('unsafe');
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  it('should return verified for behavior without temporal specs', async () => {
    const domainNoTemporal = {
      ...mockDomain,
      behaviors: [
        {
          ...mockDomain.behaviors[0],
          name: { kind: 'Identifier' as const, name: 'NoTemporal', location: {} as never },
          temporal: [],
        },
      ],
    };
    
    const result = await verify('./impl.ts', domainNoTemporal, 'NoTemporal');
    
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('verified');
    expect(result.score).toBe(100);
  });
});

describe('formatVerifyResult', () => {
  it('should format result as readable report', () => {
    const result = {
      success: true,
      verdict: 'verified' as const,
      score: 100,
      temporalResults: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalDuration: 123,
      },
      errors: [],
    };
    
    const report = formatVerifyResult(result);
    
    expect(report).toContain('VERIFIED');
    expect(report).toContain('100');
    expect(report).toContain('PASSED');
  });
});
