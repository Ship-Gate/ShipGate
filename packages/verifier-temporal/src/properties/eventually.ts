/**
 * Eventually property checker
 * 
 * Verifies that a condition eventually becomes true within a timeout.
 * Polls at specified intervals until the condition is met or timeout expires.
 */

import { sleep, toMilliseconds, now, formatDuration } from '../timing.js';

export interface EventuallyOptions {
  /** Maximum time to wait in ms (default: 5000) */
  timeout?: number;
  /** Polling interval in ms (default: 100) */
  interval?: number;
  /** Description for error messages */
  description?: string;
}

export interface EventuallyResult {
  /** Whether the condition was eventually satisfied */
  success: boolean;
  /** Time taken to satisfy (or timeout) in ms */
  duration: number;
  /** Number of attempts made */
  attempts: number;
  /** Error message if failed */
  error?: string;
  /** The final value returned by the predicate */
  finalValue?: unknown;
}

/**
 * Default options for eventually checks
 */
export const DEFAULT_EVENTUALLY_OPTIONS: Required<Omit<EventuallyOptions, 'description'>> = {
  timeout: 5000,
  interval: 100,
};

/**
 * Check that a condition eventually becomes true
 * 
 * @param predicate - Function that returns true when condition is satisfied
 * @param options - Configuration options
 * @returns Result indicating success/failure and timing
 * 
 * @example
 * ```typescript
 * // Wait for user to be created
 * const result = await eventually(
 *   async () => await db.userExists(userId),
 *   { timeout: 10000, description: 'user creation' }
 * );
 * ```
 */
export async function eventually(
  predicate: () => Promise<boolean> | boolean,
  options: EventuallyOptions = {}
): Promise<EventuallyResult> {
  const timeout = options.timeout ?? DEFAULT_EVENTUALLY_OPTIONS.timeout;
  const interval = options.interval ?? DEFAULT_EVENTUALLY_OPTIONS.interval;
  const description = options.description ?? 'condition';
  
  const startTime = now();
  const deadline = startTime + timeout;
  let attempts = 0;
  let lastError: Error | undefined;
  let finalValue: unknown;
  
  while (now() < deadline) {
    attempts++;
    
    try {
      const result = await predicate();
      finalValue = result;
      
      if (result === true) {
        const duration = now() - startTime;
        return {
          success: true,
          duration,
          attempts,
          finalValue,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      finalValue = undefined;
    }
    
    // Wait before next attempt, but don't overshoot deadline
    const remaining = deadline - now();
    if (remaining > 0) {
      await sleep(Math.min(interval, remaining));
    }
  }
  
  const duration = now() - startTime;
  const errorMsg = lastError 
    ? `${description} did not become true within ${formatDuration(timeout)}: ${lastError.message}`
    : `${description} did not become true within ${formatDuration(timeout)} after ${attempts} attempts`;
  
  return {
    success: false,
    duration,
    attempts,
    error: errorMsg,
    finalValue,
  };
}

/**
 * Check that a condition eventually becomes true with duration units
 */
export async function eventuallyWithin(
  predicate: () => Promise<boolean> | boolean,
  value: number,
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days',
  options: Omit<EventuallyOptions, 'timeout'> = {}
): Promise<EventuallyResult> {
  const timeout = toMilliseconds(value, unit);
  return eventually(predicate, { ...options, timeout });
}

/**
 * Create an eventually checker with preset options
 */
export function createEventuallyChecker(defaultOptions: EventuallyOptions) {
  return async (
    predicate: () => Promise<boolean> | boolean,
    options: EventuallyOptions = {}
  ): Promise<EventuallyResult> => {
    return eventually(predicate, { ...defaultOptions, ...options });
  };
}

/**
 * Check multiple conditions eventually become true (all must succeed)
 */
export async function eventuallyAll(
  predicates: Array<{
    predicate: () => Promise<boolean> | boolean;
    description?: string;
  }>,
  options: EventuallyOptions = {}
): Promise<{
  success: boolean;
  results: EventuallyResult[];
  totalDuration: number;
}> {
  const startTime = now();
  const results = await Promise.all(
    predicates.map(p => eventually(p.predicate, { 
      ...options, 
      description: p.description 
    }))
  );
  
  return {
    success: results.every(r => r.success),
    results,
    totalDuration: now() - startTime,
  };
}

/**
 * Check that at least one condition eventually becomes true
 */
export async function eventuallyAny(
  predicates: Array<{
    predicate: () => Promise<boolean> | boolean;
    description?: string;
  }>,
  options: EventuallyOptions = {}
): Promise<{
  success: boolean;
  successIndex?: number;
  results: EventuallyResult[];
  totalDuration: number;
}> {
  const startTime = now();
  const timeout = options.timeout ?? DEFAULT_EVENTUALLY_OPTIONS.timeout;
  const interval = options.interval ?? DEFAULT_EVENTUALLY_OPTIONS.interval;
  const deadline = startTime + timeout;
  
  const attempts = new Array(predicates.length).fill(0);
  const errors: (Error | undefined)[] = new Array(predicates.length).fill(undefined);
  
  while (now() < deadline) {
    for (let i = 0; i < predicates.length; i++) {
      const p = predicates[i];
      if (!p) continue;
      
      attempts[i]++;
      
      try {
        const result = await p.predicate();
        if (result === true) {
          const duration = now() - startTime;
          const results: EventuallyResult[] = predicates.map((pred, idx) => ({
            success: idx === i,
            duration: idx === i ? duration : 0,
            attempts: attempts[idx] ?? 0,
          }));
          
          return {
            success: true,
            successIndex: i,
            results,
            totalDuration: duration,
          };
        }
      } catch (error) {
        errors[i] = error instanceof Error ? error : new Error(String(error));
      }
    }
    
    const remaining = deadline - now();
    if (remaining > 0) {
      await sleep(Math.min(interval, remaining));
    }
  }
  
  const totalDuration = now() - startTime;
  const results: EventuallyResult[] = predicates.map((p, i) => ({
    success: false,
    duration: totalDuration,
    attempts: attempts[i] ?? 0,
    error: errors[i]?.message ?? `${p.description ?? 'condition'} did not become true`,
  }));
  
  return {
    success: false,
    results,
    totalDuration,
  };
}
