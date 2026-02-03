/**
 * Comprehensive tests for percentile calculations
 * 
 * Tests edge cases, determinism, and statistical correctness
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePercentile,
  calculatePercentiles,
  calculateLatencyStats,
  meetsLatencyThreshold,
  formatLatencyStats,
} from '../src/percentiles.js';

// ============================================================================
// PERCENTILE CALCULATION TESTS
// ============================================================================

describe('calculatePercentile', () => {
  describe('basic percentiles', () => {
    it('should return min value for p0', () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 0)).toBe(10);
    });

    it('should return max value for p100', () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 100)).toBe(50);
    });

    it('should calculate p50 (median) correctly for odd count', () => {
      const values = [1, 2, 3, 4, 5];
      expect(calculatePercentile(values, 50)).toBe(3);
    });

    it('should interpolate p50 for even count', () => {
      const values = [1, 2, 3, 4, 5, 6];
      expect(calculatePercentile(values, 50)).toBeCloseTo(3.5, 5);
    });
  });

  describe('common SLA percentiles', () => {
    // Create a realistic latency distribution
    const latencies = Array.from({ length: 100 }, (_, i) => {
      // Most values are low, some outliers are high (realistic latency)
      if (i < 90) return 10 + Math.random() * 40; // 10-50ms
      if (i < 98) return 50 + Math.random() * 100; // 50-150ms
      return 150 + Math.random() * 350; // 150-500ms (outliers)
    }).sort((a, b) => a - b);

    it('should calculate p50 correctly', () => {
      const p50 = calculatePercentile(latencies, 50);
      expect(p50).toBeGreaterThan(0);
      expect(p50).toBeLessThan(100); // Should be in the normal range
    });

    it('should calculate p95 correctly', () => {
      const p95 = calculatePercentile(latencies, 95);
      expect(p95).toBeGreaterThan(calculatePercentile(latencies, 50));
    });

    it('should calculate p99 correctly', () => {
      const p99 = calculatePercentile(latencies, 99);
      expect(p99).toBeGreaterThan(calculatePercentile(latencies, 95));
    });

    it('should calculate p99.9 correctly', () => {
      const p999 = calculatePercentile(latencies, 99.9);
      expect(p999).toBeGreaterThanOrEqual(calculatePercentile(latencies, 99));
    });
  });

  describe('edge cases', () => {
    it('should return 0 for empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should return the single value for single-element array', () => {
      expect(calculatePercentile([42], 0)).toBe(42);
      expect(calculatePercentile([42], 50)).toBe(42);
      expect(calculatePercentile([42], 100)).toBe(42);
    });

    it('should handle two-element array', () => {
      const values = [10, 20];
      expect(calculatePercentile(values, 0)).toBe(10);
      expect(calculatePercentile(values, 50)).toBe(15);
      expect(calculatePercentile(values, 100)).toBe(20);
    });

    it('should handle negative percentiles (clamp to min)', () => {
      const values = [1, 2, 3];
      expect(calculatePercentile(values, -10)).toBe(1);
    });

    it('should handle percentiles > 100 (clamp to max)', () => {
      const values = [1, 2, 3];
      expect(calculatePercentile(values, 150)).toBe(3);
    });

    it('should handle identical values', () => {
      const values = [50, 50, 50, 50, 50];
      expect(calculatePercentile(values, 0)).toBe(50);
      expect(calculatePercentile(values, 50)).toBe(50);
      expect(calculatePercentile(values, 99)).toBe(50);
    });

    it('should handle very large values', () => {
      const values = [1e10, 2e10, 3e10];
      expect(calculatePercentile(values, 50)).toBe(2e10);
    });

    it('should handle very small values', () => {
      const values = [0.001, 0.002, 0.003];
      expect(calculatePercentile(values, 50)).toBe(0.002);
    });

    it('should handle mixed positive and negative', () => {
      const values = [-10, -5, 0, 5, 10];
      expect(calculatePercentile(values, 50)).toBe(0);
    });
  });

  describe('determinism', () => {
    it('should return identical results for identical inputs', () => {
      const values = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      
      const result1 = calculatePercentile(values, 75);
      const result2 = calculatePercentile(values, 75);
      const result3 = calculatePercentile([...values], 75);
      
      expect(result1).toBe(result2);
      expect(result1).toBe(result3);
    });

    it('should produce stable results across many iterations', () => {
      const values = Array.from({ length: 1000 }, (_, i) => i + 1);
      const results: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        results.push(calculatePercentile(values, 95));
      }
      
      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });
  });

  describe('interpolation accuracy', () => {
    it('should use linear interpolation between values', () => {
      const values = [0, 100];
      
      expect(calculatePercentile(values, 25)).toBe(25);
      expect(calculatePercentile(values, 50)).toBe(50);
      expect(calculatePercentile(values, 75)).toBe(75);
    });

    it('should interpolate correctly with uneven distribution', () => {
      const values = [1, 2, 4, 8, 16]; // Exponential growth
      const p50 = calculatePercentile(values, 50);
      
      // p50 should be the middle value (4) for 5 elements
      expect(p50).toBe(4);
    });
  });
});

describe('calculatePercentiles', () => {
  it('should calculate multiple percentiles at once', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const results = calculatePercentiles(values, [25, 50, 75, 90, 95, 99]);
    
    expect(results).toHaveLength(6);
    expect(results[0]?.percentile).toBe(25);
    expect(results[1]?.percentile).toBe(50);
    
    // Values should be increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.value).toBeGreaterThanOrEqual(results[i - 1]!.value);
    }
  });

  it('should handle empty values', () => {
    const results = calculatePercentiles([], [50, 99]);
    
    expect(results).toHaveLength(2);
    expect(results.every(r => r.value === 0)).toBe(true);
  });

  it('should handle unsorted input', () => {
    const values = [50, 10, 30, 20, 40];
    const results = calculatePercentiles(values, [50]);
    
    expect(results[0]?.value).toBe(30); // Median of sorted [10,20,30,40,50]
  });
});

// ============================================================================
// LATENCY STATS TESTS
// ============================================================================

describe('calculateLatencyStats', () => {
  it('should calculate all standard statistics', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      duration: (i + 1) * 10, // 10, 20, 30, ..., 1000
      success: true,
    }));
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(1000);
    expect(stats.mean).toBeCloseTo(505, 1);
    expect(stats.median).toBeCloseTo(505, 1);
    expect(stats.count).toBe(100);
    expect(stats.successCount).toBe(100);
    expect(stats.failureCount).toBe(0);
    
    // Percentiles should be in order
    expect(stats.p50).toBeLessThanOrEqual(stats.p75);
    expect(stats.p75).toBeLessThanOrEqual(stats.p90);
    expect(stats.p90).toBeLessThanOrEqual(stats.p95);
    expect(stats.p95).toBeLessThanOrEqual(stats.p99);
    expect(stats.p99).toBeLessThanOrEqual(stats.p999);
  });

  it('should calculate standard deviation correctly', () => {
    // Known distribution for easy verification
    const samples = [
      { duration: 10, success: true },
      { duration: 20, success: true },
      { duration: 30, success: true },
      { duration: 40, success: true },
      { duration: 50, success: true },
    ];
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.mean).toBe(30);
    // StdDev = sqrt((400 + 100 + 0 + 100 + 400) / 5) = sqrt(200) ≈ 14.14
    expect(stats.stdDev).toBeCloseTo(14.14, 1);
  });

  it('should only use successful samples for statistics', () => {
    const samples = [
      { duration: 10, success: true },
      { duration: 1000, success: false }, // Should be excluded
      { duration: 20, success: true },
      { duration: 2000, success: false }, // Should be excluded
      { duration: 30, success: true },
    ];
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.count).toBe(5);
    expect(stats.successCount).toBe(3);
    expect(stats.failureCount).toBe(2);
    expect(stats.max).toBe(30); // Max of successful only
    expect(stats.mean).toBe(20); // Mean of successful only
  });

  it('should handle all failures', () => {
    const samples = [
      { duration: 10, success: false },
      { duration: 20, success: false },
    ];
    
    const stats = calculateLatencyStats(samples);
    
    expect(stats.count).toBe(2);
    expect(stats.successCount).toBe(0);
    expect(stats.failureCount).toBe(2);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.mean).toBe(0);
  });

  it('should handle empty samples', () => {
    const stats = calculateLatencyStats([]);
    
    expect(stats.count).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
  });
});

// ============================================================================
// THRESHOLD TESTS
// ============================================================================

describe('meetsLatencyThreshold', () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({
    duration: i + 1, // 1-100
    success: true,
  }));

  it('should return true when threshold is met', () => {
    const result = meetsLatencyThreshold(samples, 95, 100);
    
    expect(result.meets).toBe(true);
    expect(result.actualValue).toBeLessThanOrEqual(100);
  });

  it('should return false when threshold is exceeded', () => {
    const result = meetsLatencyThreshold(samples, 99, 50);
    
    expect(result.meets).toBe(false);
    expect(result.actualValue).toBeGreaterThan(50);
  });

  it('should handle edge case at exact threshold', () => {
    // Create samples where p99 is exactly 99
    const exactSamples = Array.from({ length: 100 }, (_, i) => ({
      duration: i + 1,
      success: true,
    }));
    
    const p99 = calculatePercentile(
      exactSamples.map(s => s.duration).sort((a, b) => a - b),
      99
    );
    
    const result = meetsLatencyThreshold(exactSamples, 99, p99);
    expect(result.meets).toBe(true);
  });

  it('should handle empty samples', () => {
    const result = meetsLatencyThreshold([], 99, 100);
    
    expect(result.meets).toBe(false);
    expect(result.actualValue).toBe(0);
  });

  it('should ignore failed samples', () => {
    const mixedSamples = [
      { duration: 10, success: true },
      { duration: 999, success: false }, // Excluded
      { duration: 20, success: true },
    ];
    
    const result = meetsLatencyThreshold(mixedSamples, 99, 50);
    
    expect(result.meets).toBe(true);
    expect(result.actualValue).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('formatLatencyStats', () => {
  it('should format stats as readable string', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({
      duration: i + 1,
      success: true,
    }));
    const stats = calculateLatencyStats(samples);
    
    const formatted = formatLatencyStats(stats);
    
    expect(formatted).toContain('Samples: 100');
    expect(formatted).toContain('Min:');
    expect(formatted).toContain('Max:');
    expect(formatted).toContain('Mean:');
    expect(formatted).toContain('Std Dev:');
    expect(formatted).toContain('p50:');
    expect(formatted).toContain('p95:');
    expect(formatted).toContain('p99:');
  });

  it('should show failure count', () => {
    const samples = [
      { duration: 10, success: true },
      { duration: 20, success: false },
    ];
    const stats = calculateLatencyStats(samples);
    
    const formatted = formatLatencyStats(stats);
    
    expect(formatted).toContain('1 successful');
    expect(formatted).toContain('1 failed');
  });
});

// ============================================================================
// DETERMINISM VERIFICATION
// ============================================================================

describe('determinism', () => {
  it('calculateLatencyStats should be deterministic', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => ({
      duration: Math.sin(i) * 100 + 100, // Deterministic pseudo-random
      success: i % 10 !== 0,
    }));
    
    const stats1 = calculateLatencyStats(samples);
    const stats2 = calculateLatencyStats(samples);
    const stats3 = calculateLatencyStats([...samples]);
    
    expect(stats1.min).toBe(stats2.min);
    expect(stats1.max).toBe(stats2.max);
    expect(stats1.mean).toBe(stats2.mean);
    expect(stats1.p99).toBe(stats2.p99);
    
    expect(stats1.min).toBe(stats3.min);
    expect(stats1.p99).toBe(stats3.p99);
  });

  it('should produce identical results regardless of object creation order', () => {
    const createSamples = () => Array.from({ length: 100 }, (_, i) => ({
      duration: i * 2,
      success: true,
    }));
    
    const stats1 = calculateLatencyStats(createSamples());
    const stats2 = calculateLatencyStats(createSamples());
    
    expect(stats1).toEqual(stats2);
  });
});
