/**
 * Latency histogram for distribution analysis
 */

import type { TimingSample } from './timing.js';

export interface HistogramBucket {
  /** Lower bound of the bucket (inclusive) in ms */
  lowerBound: number;
  /** Upper bound of the bucket (exclusive) in ms */
  upperBound: number;
  /** Number of samples in this bucket */
  count: number;
  /** Percentage of total samples */
  percentage: number;
}

export interface Histogram {
  /** Histogram buckets */
  buckets: HistogramBucket[];
  /** Total sample count */
  totalCount: number;
  /** Bucket width in ms */
  bucketWidth: number;
  /** Minimum value seen */
  minValue: number;
  /** Maximum value seen */
  maxValue: number;
}

export interface HistogramOptions {
  /** Number of buckets (default: 20) */
  bucketCount?: number;
  /** Custom bucket boundaries (overrides bucketCount) */
  boundaries?: number[];
  /** Fixed bucket width (overrides bucketCount) */
  fixedWidth?: number;
  /** Minimum value for first bucket */
  minValue?: number;
  /** Maximum value for last bucket */
  maxValue?: number;
}

/**
 * Default exponential bucket boundaries (in ms) for latency histograms
 */
export const DEFAULT_LATENCY_BOUNDARIES = [
  0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

/**
 * Create a histogram from timing samples
 */
export function createHistogram(
  samples: TimingSample[],
  options: HistogramOptions = {}
): Histogram {
  const successful = samples.filter(s => s.success);
  const durations = successful.map(s => s.duration);
  
  if (durations.length === 0) {
    return {
      buckets: [],
      totalCount: 0,
      bucketWidth: 0,
      minValue: 0,
      maxValue: 0,
    };
  }
  
  const minValue = options.minValue ?? Math.min(...durations);
  const maxValue = options.maxValue ?? Math.max(...durations);
  
  let boundaries: number[];
  
  if (options.boundaries) {
    boundaries = [...options.boundaries].sort((a, b) => a - b);
  } else if (options.fixedWidth) {
    boundaries = [];
    let bound = minValue;
    while (bound <= maxValue) {
      boundaries.push(bound);
      bound += options.fixedWidth;
    }
    boundaries.push(bound);
  } else {
    const bucketCount = options.bucketCount ?? 20;
    const width = (maxValue - minValue) / bucketCount;
    boundaries = [];
    for (let i = 0; i <= bucketCount; i++) {
      boundaries.push(minValue + i * width);
    }
  }
  
  // Create buckets
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const lowerBound = boundaries[i] ?? 0;
    const upperBound = boundaries[i + 1] ?? 0;
    const count = durations.filter(d => d >= lowerBound && d < upperBound).length;
    buckets.push({
      lowerBound,
      upperBound,
      count,
      percentage: (count / durations.length) * 100,
    });
  }
  
  // Handle values >= last boundary
  const lastBoundary = boundaries[boundaries.length - 1] ?? 0;
  const overflowCount = durations.filter(d => d >= lastBoundary).length;
  if (overflowCount > 0) {
    buckets.push({
      lowerBound: lastBoundary,
      upperBound: Infinity,
      count: overflowCount,
      percentage: (overflowCount / durations.length) * 100,
    });
  }
  
  const bucketWidth = boundaries.length > 1 
    ? (boundaries[1] ?? 0) - (boundaries[0] ?? 0)
    : 0;
  
  return {
    buckets,
    totalCount: durations.length,
    bucketWidth,
    minValue,
    maxValue,
  };
}

/**
 * Create a histogram using default latency boundaries
 */
export function createLatencyHistogram(samples: TimingSample[]): Histogram {
  return createHistogram(samples, { boundaries: DEFAULT_LATENCY_BOUNDARIES });
}

/**
 * Format histogram as ASCII bar chart
 */
export function formatHistogramAscii(histogram: Histogram, width: number = 40): string {
  if (histogram.buckets.length === 0) {
    return 'No data';
  }
  
  const maxCount = Math.max(...histogram.buckets.map(b => b.count));
  const lines: string[] = [];
  
  for (const bucket of histogram.buckets) {
    const barLength = maxCount > 0 
      ? Math.round((bucket.count / maxCount) * width)
      : 0;
    const bar = '█'.repeat(barLength);
    const upperLabel = bucket.upperBound === Infinity 
      ? '∞' 
      : bucket.upperBound.toFixed(1);
    const label = `[${bucket.lowerBound.toFixed(1)}-${upperLabel})ms`;
    const countStr = `${bucket.count} (${bucket.percentage.toFixed(1)}%)`;
    lines.push(`${label.padEnd(20)} ${bar.padEnd(width)} ${countStr}`);
  }
  
  return lines.join('\n');
}

/**
 * Get cumulative distribution from histogram
 */
export function getCumulativeDistribution(histogram: Histogram): Array<{
  value: number;
  cumulativePercentage: number;
}> {
  let cumulative = 0;
  const distribution: Array<{ value: number; cumulativePercentage: number }> = [];
  
  for (const bucket of histogram.buckets) {
    cumulative += bucket.percentage;
    distribution.push({
      value: bucket.upperBound,
      cumulativePercentage: cumulative,
    });
  }
  
  return distribution;
}

/**
 * Merge multiple histograms (must have same boundaries)
 */
export function mergeHistograms(histograms: Histogram[]): Histogram {
  if (histograms.length === 0) {
    return {
      buckets: [],
      totalCount: 0,
      bucketWidth: 0,
      minValue: 0,
      maxValue: 0,
    };
  }
  
  const first = histograms[0];
  if (!first) {
    return {
      buckets: [],
      totalCount: 0,
      bucketWidth: 0,
      minValue: 0,
      maxValue: 0,
    };
  }
  
  const totalCount = histograms.reduce((sum, h) => sum + h.totalCount, 0);
  const minValue = Math.min(...histograms.map(h => h.minValue));
  const maxValue = Math.max(...histograms.map(h => h.maxValue));
  
  const buckets: HistogramBucket[] = first.buckets.map((bucket, i) => {
    const count = histograms.reduce((sum, h) => sum + (h.buckets[i]?.count ?? 0), 0);
    return {
      lowerBound: bucket.lowerBound,
      upperBound: bucket.upperBound,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    };
  });
  
  return {
    buckets,
    totalCount,
    bucketWidth: first.bucketWidth,
    minValue,
    maxValue,
  };
}
