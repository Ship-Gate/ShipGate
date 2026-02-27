/**
 * Timing utilities for latency measurement
 */

export interface TimingResult {
  /** Duration in milliseconds */
  duration: number;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt: number;
}

export interface TimingSample {
  /** Duration in milliseconds */
  duration: number;
  /** Whether the execution succeeded */
  success: boolean;
  /** Optional error if execution failed */
  error?: Error;
  /** Result value if successful */
  result?: unknown;
}

/**
 * High-resolution timer using performance.now() when available
 */
export function now(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

/**
 * Measure the execution time of an async function
 */
export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<TimingResult & { result: T }> {
  const startedAt = now();
  const result = await fn();
  const endedAt = now();
  
  return {
    duration: endedAt - startedAt,
    startedAt,
    endedAt,
    result,
  };
}

/**
 * Measure the execution time of a sync function
 */
export function measureSync<T>(
  fn: () => T
): TimingResult & { result: T } {
  const startedAt = now();
  const result = fn();
  const endedAt = now();
  
  return {
    duration: endedAt - startedAt,
    startedAt,
    endedAt,
    result,
  };
}

/**
 * Collect multiple timing samples from an async function
 */
export async function collectSamples(
  fn: () => Promise<unknown>,
  count: number
): Promise<TimingSample[]> {
  const samples: TimingSample[] = [];
  
  for (let i = 0; i < count; i++) {
    const startedAt = now();
    try {
      const result = await fn();
      const endedAt = now();
      samples.push({
        duration: endedAt - startedAt,
        success: true,
        result,
      });
    } catch (error) {
      const endedAt = now();
      samples.push({
        duration: endedAt - startedAt,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  
  return samples;
}

/**
 * Collect samples in parallel batches
 */
export async function collectSamplesParallel(
  fn: () => Promise<unknown>,
  count: number,
  concurrency: number = 10
): Promise<TimingSample[]> {
  const samples: TimingSample[] = [];
  const batches = Math.ceil(count / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, count - batch * concurrency);
    const batchPromises = Array.from({ length: batchSize }, async () => {
      const startedAt = now();
      try {
        const result = await fn();
        const endedAt = now();
        return {
          duration: endedAt - startedAt,
          success: true,
          result,
        } as TimingSample;
      } catch (error) {
        const endedAt = now();
        return {
          duration: endedAt - startedAt,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        } as TimingSample;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    samples.push(...batchResults);
  }
  
  return samples;
}

/**
 * Convert duration units to milliseconds
 */
export function toMilliseconds(
  value: number,
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days'
): number {
  switch (unit) {
    case 'ms':
      return value;
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(2)}m`;
  }
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
