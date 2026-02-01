/**
 * Within property checker
 * 
 * Verifies that operations complete within specified latency bounds,
 * typically at a given percentile (e.g., p99 < 200ms).
 */

import { collectSamples, collectSamplesParallel, toMilliseconds, formatDuration } from '../timing.js';
import type { TimingSample } from '../timing.js';
import { calculateLatencyStats, meetsLatencyThreshold, formatLatencyStats } from '../percentiles.js';
import type { LatencyStats } from '../percentiles.js';
import { createLatencyHistogram, formatHistogramAscii } from '../histogram.js';
import type { Histogram } from '../histogram.js';

export interface WithinOptions {
  /** Number of samples to collect (default: 100) */
  sampleCount?: number;
  /** The percentile to check (default: 99 for p99) */
  percentile?: number;
  /** Run samples in parallel with this concurrency */
  parallel?: number;
  /** Warmup runs before collecting samples (default: 5) */
  warmupRuns?: number;
  /** Description for error messages */
  description?: string;
}

export interface WithinResult {
  /** Whether the latency requirement was met */
  success: boolean;
  /** The actual latency at the specified percentile */
  actualLatency: number;
  /** The threshold that was checked against */
  threshold: number;
  /** The percentile that was checked */
  percentile: number;
  /** Full latency statistics */
  stats: LatencyStats;
  /** Latency histogram */
  histogram: Histogram;
  /** All timing samples */
  samples: TimingSample[];
  /** Error message if failed */
  error?: string;
}

/**
 * Default options for within checks
 */
export const DEFAULT_WITHIN_OPTIONS: Required<Omit<WithinOptions, 'description' | 'parallel'>> = {
  sampleCount: 100,
  percentile: 99,
  warmupRuns: 5,
};

/**
 * Check that an operation completes within a latency threshold
 * 
 * @param operation - Async function to measure
 * @param thresholdMs - Maximum allowed latency in milliseconds
 * @param options - Configuration options
 * @returns Result with detailed latency statistics
 * 
 * @example
 * ```typescript
 * // Check p99 latency is under 200ms
 * const result = await within(
 *   async () => await api.createUser(userData),
 *   200,
 *   { percentile: 99, sampleCount: 100 }
 * );
 * ```
 */
export async function within(
  operation: () => Promise<unknown>,
  thresholdMs: number,
  options: WithinOptions = {}
): Promise<WithinResult> {
  const sampleCount = options.sampleCount ?? DEFAULT_WITHIN_OPTIONS.sampleCount;
  const percentile = options.percentile ?? DEFAULT_WITHIN_OPTIONS.percentile;
  const warmupRuns = options.warmupRuns ?? DEFAULT_WITHIN_OPTIONS.warmupRuns;
  const description = options.description ?? 'operation';
  
  // Warmup runs (discard results)
  for (let i = 0; i < warmupRuns; i++) {
    try {
      await operation();
    } catch {
      // Ignore warmup errors
    }
  }
  
  // Collect samples
  const samples = options.parallel
    ? await collectSamplesParallel(operation, sampleCount, options.parallel)
    : await collectSamples(operation, sampleCount);
  
  // Calculate statistics
  const stats = calculateLatencyStats(samples);
  const histogram = createLatencyHistogram(samples);
  const { meets, actualValue } = meetsLatencyThreshold(samples, percentile, thresholdMs);
  
  if (!meets) {
    const error = `${description} p${percentile} latency (${formatDuration(actualValue)}) exceeds threshold (${formatDuration(thresholdMs)})`;
    return {
      success: false,
      actualLatency: actualValue,
      threshold: thresholdMs,
      percentile,
      stats,
      histogram,
      samples,
      error,
    };
  }
  
  return {
    success: true,
    actualLatency: actualValue,
    threshold: thresholdMs,
    percentile,
    stats,
    histogram,
    samples,
  };
}

/**
 * Check latency with duration units
 */
export async function withinDuration(
  operation: () => Promise<unknown>,
  value: number,
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days',
  options: WithinOptions = {}
): Promise<WithinResult> {
  const thresholdMs = toMilliseconds(value, unit);
  return within(operation, thresholdMs, options);
}

/**
 * Check multiple percentiles at once
 */
export async function withinMultiple(
  operation: () => Promise<unknown>,
  thresholds: Array<{ percentile: number; maxLatencyMs: number }>,
  options: Omit<WithinOptions, 'percentile'> = {}
): Promise<{
  success: boolean;
  results: Array<{
    percentile: number;
    threshold: number;
    actualLatency: number;
    success: boolean;
  }>;
  stats: LatencyStats;
  histogram: Histogram;
  samples: TimingSample[];
}> {
  const sampleCount = options.sampleCount ?? DEFAULT_WITHIN_OPTIONS.sampleCount;
  const warmupRuns = options.warmupRuns ?? DEFAULT_WITHIN_OPTIONS.warmupRuns;
  
  // Warmup
  for (let i = 0; i < warmupRuns; i++) {
    try {
      await operation();
    } catch {
      // Ignore
    }
  }
  
  // Collect samples once
  const samples = options.parallel
    ? await collectSamplesParallel(operation, sampleCount, options.parallel)
    : await collectSamples(operation, sampleCount);
  
  const stats = calculateLatencyStats(samples);
  const histogram = createLatencyHistogram(samples);
  
  // Check each threshold
  const results = thresholds.map(t => {
    const { meets, actualValue } = meetsLatencyThreshold(samples, t.percentile, t.maxLatencyMs);
    return {
      percentile: t.percentile,
      threshold: t.maxLatencyMs,
      actualLatency: actualValue,
      success: meets,
    };
  });
  
  return {
    success: results.every(r => r.success),
    results,
    stats,
    histogram,
    samples,
  };
}

/**
 * Format within result as a readable report
 */
export function formatWithinResult(result: WithinResult): string {
  const status = result.success ? '✓ PASS' : '✗ FAIL';
  const lines = [
    `${status}: p${result.percentile} latency check`,
    `  Threshold: ${formatDuration(result.threshold)}`,
    `  Actual: ${formatDuration(result.actualLatency)}`,
    '',
    'Statistics:',
    formatLatencyStats(result.stats),
    '',
    'Distribution:',
    formatHistogramAscii(result.histogram, 30),
  ];
  
  if (result.error) {
    lines.unshift(`Error: ${result.error}`);
  }
  
  return lines.join('\n');
}

/**
 * Create a within checker with preset options
 */
export function createWithinChecker(defaultOptions: WithinOptions) {
  return async (
    operation: () => Promise<unknown>,
    thresholdMs: number,
    options: WithinOptions = {}
  ): Promise<WithinResult> => {
    return within(operation, thresholdMs, { ...defaultOptions, ...options });
  };
}

/**
 * Assert that an operation completes within the threshold
 * Throws if the check fails
 */
export async function assertWithin(
  operation: () => Promise<unknown>,
  thresholdMs: number,
  options: WithinOptions = {}
): Promise<WithinResult> {
  const result = await within(operation, thresholdMs, options);
  
  if (!result.success) {
    const error = new Error(result.error);
    error.name = 'LatencyAssertionError';
    throw error;
  }
  
  return result;
}
