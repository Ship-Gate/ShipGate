/**
 * Comparator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  compare,
  quickCompare,
  deepEqual,
  diff,
  generateOutputDiff,
  calculateMetrics,
  comparePerformance,
  calculateCoverage,
  compareCoverage,
  type Implementation,
  type TestInput,
  type TimingData,
  type TestCaseResult,
  type PerformanceMetrics,
} from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Deep Equality Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('deepEqual', () => {
  it('should compare primitives', () => {
    expect(deepEqual(1, 1).equal).toBe(true);
    expect(deepEqual(1, 2).equal).toBe(false);
    expect(deepEqual('a', 'a').equal).toBe(true);
    expect(deepEqual('a', 'b').equal).toBe(false);
    expect(deepEqual(true, true).equal).toBe(true);
    expect(deepEqual(true, false).equal).toBe(false);
  });

  it('should compare null and undefined', () => {
    expect(deepEqual(null, null).equal).toBe(true);
    expect(deepEqual(undefined, undefined).equal).toBe(true);
    expect(deepEqual(null, undefined).equal).toBe(false);
  });

  it('should compare arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3]).equal).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4]).equal).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3]).equal).toBe(false);
  });

  it('should compare objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }).equal).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 }).equal).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 }).equal).toBe(false);
  });

  it('should compare nested structures', () => {
    const obj1 = { a: { b: { c: [1, 2, 3] } } };
    const obj2 = { a: { b: { c: [1, 2, 3] } } };
    const obj3 = { a: { b: { c: [1, 2, 4] } } };

    expect(deepEqual(obj1, obj2).equal).toBe(true);
    expect(deepEqual(obj1, obj3).equal).toBe(false);
  });

  it('should respect float tolerance', () => {
    expect(deepEqual(1.0, 1.0001, { floatTolerance: 0.001 }).equal).toBe(true);
    expect(deepEqual(1.0, 1.01, { floatTolerance: 0.001 }).equal).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Diff Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('should detect additions', () => {
    const changes = diff({ a: 1 }, { a: 1, b: 2 });
    expect(changes).toContainEqual(expect.objectContaining({ type: 'add', path: 'b' }));
  });

  it('should detect removals', () => {
    const changes = diff({ a: 1, b: 2 }, { a: 1 });
    expect(changes).toContainEqual(expect.objectContaining({ type: 'remove', path: 'b' }));
  });

  it('should detect modifications', () => {
    const changes = diff({ a: 1 }, { a: 2 });
    expect(changes).toContainEqual(expect.objectContaining({ type: 'modify', path: 'a' }));
  });

  it('should handle nested changes', () => {
    const changes = diff({ a: { b: 1 } }, { a: { b: 2 } });
    expect(changes).toContainEqual(expect.objectContaining({ type: 'modify', path: 'a.b' }));
  });

  it('should handle array changes', () => {
    const changes = diff([1, 2, 3], [1, 2, 4]);
    expect(changes).toContainEqual(expect.objectContaining({ type: 'modify', path: '[2]' }));
  });
});

describe('generateOutputDiff', () => {
  it('should generate summary', () => {
    const result = generateOutputDiff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
    expect(result.summary.modifications).toBe(1);
    expect(result.summary.additions).toBe(1);
    expect(result.summary.totalChanges).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateMetrics', () => {
  it('should calculate basic metrics', () => {
    const timings: TimingData[] = [
      { duration: 10, error: false },
      { duration: 20, error: false },
      { duration: 30, error: false },
      { duration: 40, error: false },
      { duration: 50, error: false },
    ];

    const metrics = calculateMetrics(timings);
    expect(metrics.latencyMean).toBe(30);
    expect(metrics.latencyMin).toBe(10);
    expect(metrics.latencyMax).toBe(50);
    expect(metrics.invocations).toBe(5);
    expect(metrics.errors).toBe(0);
  });

  it('should count errors', () => {
    const timings: TimingData[] = [
      { duration: 10, error: false },
      { duration: 20, error: true },
      { duration: 30, error: false },
    ];

    const metrics = calculateMetrics(timings);
    expect(metrics.errors).toBe(1);
    expect(metrics.errorRate).toBeCloseTo(33.33, 1);
  });
});

describe('comparePerformance', () => {
  it('should identify winner', () => {
    const metricsMap = new Map<string, PerformanceMetrics>([
      ['impl-a', {
        latencyP50: 10, latencyP95: 15, latencyP99: 20,
        latencyMin: 5, latencyMax: 25, latencyMean: 12, latencyStdDev: 3,
        memoryMB: 50, memoryPeakMB: 60, throughputRPS: 100,
        invocations: 100, errors: 0, errorRate: 0,
      }],
      ['impl-b', {
        latencyP50: 20, latencyP95: 30, latencyP99: 40,
        latencyMin: 15, latencyMax: 50, latencyMean: 25, latencyStdDev: 5,
        memoryMB: 40, memoryPeakMB: 50, throughputRPS: 50,
        invocations: 100, errors: 0, errorRate: 0,
      }],
    ]);

    const result = comparePerformance(metricsMap);
    expect(result.winner).toBe('impl-a');
    expect(result.rankings.byLatencyP50[0]).toBe('impl-a');
    expect(result.rankings.byMemory[0]).toBe('impl-b');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateCoverage', () => {
  it('should calculate pass rate', () => {
    const results: TestCaseResult[] = [
      { name: 'test1', passed: true, duration: 10, category: 'scenario' },
      { name: 'test2', passed: true, duration: 20, category: 'scenario' },
      { name: 'test3', passed: false, duration: 30, category: 'scenario', error: 'failed' },
    ];

    const coverage = calculateCoverage(results);
    expect(coverage.passed).toBe(2);
    expect(coverage.failed).toBe(1);
    expect(coverage.passRate).toBeCloseTo(66.67, 1);
  });

  it('should calculate by category', () => {
    const results: TestCaseResult[] = [
      { name: 'test1', passed: true, duration: 10, category: 'postcondition' },
      { name: 'test2', passed: false, duration: 20, category: 'postcondition', error: 'failed' },
      { name: 'test3', passed: true, duration: 30, category: 'scenario' },
    ];

    const coverage = calculateCoverage(results);
    expect(coverage.byCategory.get('postcondition')?.passRate).toBe(50);
    expect(coverage.byCategory.get('scenario')?.passRate).toBe(100);
  });
});

describe('compareCoverage', () => {
  it('should identify divergent tests', () => {
    const results = new Map<string, TestCaseResult[]>([
      ['impl-a', [
        { name: 'test1', passed: true, duration: 10, category: 'scenario' },
        { name: 'test2', passed: true, duration: 20, category: 'scenario' },
      ]],
      ['impl-b', [
        { name: 'test1', passed: true, duration: 10, category: 'scenario' },
        { name: 'test2', passed: false, duration: 20, category: 'scenario', error: 'failed' },
      ]],
    ]);

    const comparison = compareCoverage(results);
    expect(comparison.universalPasses).toContain('test1');
    expect(comparison.divergentTests).toHaveLength(1);
    expect(comparison.divergentTests[0].testName).toBe('test2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('compare', () => {
  it('should compare equivalent implementations', async () => {
    const implementations: Implementation[] = [
      { name: 'add-v1', execute: (x: number) => x + 1 },
      { name: 'add-v2', execute: (x: number) => x + 1 },
    ];

    const inputs: TestInput[] = [
      { input: 1, name: 'test-1' },
      { input: 5, name: 'test-2' },
      { input: 10, name: 'test-3' },
    ];

    const result = await compare(implementations, inputs);
    expect(result.equivalence.equivalent).toBe(true);
    expect(result.implementations).toHaveLength(2);
  });

  it('should detect non-equivalent implementations', async () => {
    const implementations: Implementation[] = [
      { name: 'add-v1', execute: (x: number) => x + 1 },
      { name: 'add-v2', execute: (x: number) => x + 2 },
    ];

    const inputs: TestInput[] = [
      { input: 1, name: 'test-1' },
      { input: 5, name: 'test-2' },
    ];

    const result = await compare(implementations, inputs);
    expect(result.equivalence.equivalent).toBe(false);
    expect(result.equivalence.differences.length).toBeGreaterThan(0);
  });

  it('should handle errors gracefully', async () => {
    const implementations: Implementation[] = [
      { name: 'safe', execute: (x: number) => x + 1 },
      { name: 'unsafe', execute: () => { throw new Error('boom'); } },
    ];

    const inputs: TestInput[] = [
      { input: 1, name: 'test-1' },
    ];

    const result = await compare(implementations, inputs);
    expect(result.equivalence.equivalent).toBe(false);
    expect(result.coverage.byImplementation.get('unsafe')?.passRate).toBe(0);
  });
});

describe('quickCompare', () => {
  it('should compare two functions', async () => {
    const result = await quickCompare(
      (x: number) => x * 2,
      (x: number) => x + x,
      [1, 2, 3, 4, 5]
    );

    expect(result.equivalence.equivalent).toBe(true);
  });
});
