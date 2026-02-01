/**
 * Percentile calculation utilities for latency analysis
 */

import type { TimingSample } from './timing.js';

export interface PercentileResult {
  /** The percentile value (e.g., 50 for p50) */
  percentile: number;
  /** The latency value at this percentile in ms */
  value: number;
}

export interface LatencyStats {
  /** Minimum latency in ms */
  min: number;
  /** Maximum latency in ms */
  max: number;
  /** Mean/average latency in ms */
  mean: number;
  /** Median latency (p50) in ms */
  median: number;
  /** Standard deviation in ms */
  stdDev: number;
  /** Common percentiles */
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  /** Total sample count */
  count: number;
  /** Successful sample count */
  successCount: number;
  /** Failed sample count */
  failureCount: number;
}

/**
 * Calculate a specific percentile from a sorted array of values
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  
  if (percentile <= 0) {
    return sortedValues[0] ?? 0;
  }
  
  if (percentile >= 100) {
    return sortedValues[sortedValues.length - 1] ?? 0;
  }
  
  // Use linear interpolation for percentile calculation
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? 0;
  
  return lowerValue + fraction * (upperValue - lowerValue);
}

/**
 * Calculate multiple percentiles at once (more efficient)
 */
export function calculatePercentiles(
  values: number[],
  percentiles: number[]
): PercentileResult[] {
  if (values.length === 0) {
    return percentiles.map(p => ({ percentile: p, value: 0 }));
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  
  return percentiles.map(p => ({
    percentile: p,
    value: calculatePercentile(sorted, p),
  }));
}

/**
 * Calculate comprehensive latency statistics from timing samples
 */
export function calculateLatencyStats(samples: TimingSample[]): LatencyStats {
  const successful = samples.filter(s => s.success);
  const durations = successful.map(s => s.duration);
  
  if (durations.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      p999: 0,
      count: samples.length,
      successCount: 0,
      failureCount: samples.length,
    };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const sum = durations.reduce((a, b) => a + b, 0);
  const mean = sum / durations.length;
  
  // Calculate standard deviation
  const squaredDiffs = durations.map(d => Math.pow(d - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / durations.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  return {
    min,
    max,
    mean,
    median: calculatePercentile(sorted, 50),
    stdDev,
    p50: calculatePercentile(sorted, 50),
    p75: calculatePercentile(sorted, 75),
    p90: calculatePercentile(sorted, 90),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    p999: calculatePercentile(sorted, 99.9),
    count: samples.length,
    successCount: successful.length,
    failureCount: samples.length - successful.length,
  };
}

/**
 * Check if a percentile meets a latency threshold
 */
export function meetsLatencyThreshold(
  samples: TimingSample[],
  percentile: number,
  thresholdMs: number
): { meets: boolean; actualValue: number } {
  const successful = samples.filter(s => s.success);
  const durations = successful.map(s => s.duration);
  
  if (durations.length === 0) {
    return { meets: false, actualValue: 0 };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const actualValue = calculatePercentile(sorted, percentile);
  
  return {
    meets: actualValue <= thresholdMs,
    actualValue,
  };
}

/**
 * Format latency stats as a human-readable string
 */
export function formatLatencyStats(stats: LatencyStats): string {
  const lines = [
    `Samples: ${stats.count} (${stats.successCount} successful, ${stats.failureCount} failed)`,
    `Min: ${stats.min.toFixed(2)}ms`,
    `Max: ${stats.max.toFixed(2)}ms`,
    `Mean: ${stats.mean.toFixed(2)}ms`,
    `Std Dev: ${stats.stdDev.toFixed(2)}ms`,
    `Percentiles:`,
    `  p50: ${stats.p50.toFixed(2)}ms`,
    `  p75: ${stats.p75.toFixed(2)}ms`,
    `  p90: ${stats.p90.toFixed(2)}ms`,
    `  p95: ${stats.p95.toFixed(2)}ms`,
    `  p99: ${stats.p99.toFixed(2)}ms`,
    `  p99.9: ${stats.p999.toFixed(2)}ms`,
  ];
  
  return lines.join('\n');
}
