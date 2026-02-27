/**
 * Always property checker (Invariant checking)
 * 
 * Verifies that a condition is always true during a period of time
 * or across multiple executions. The check fails immediately if
 * the condition ever becomes false.
 */

import { sleep, now, formatDuration, toMilliseconds } from '../timing.js';

export interface AlwaysOptions {
  /** Duration to monitor in ms (default: 1000) */
  duration?: number;
  /** Check interval in ms (default: 50) */
  interval?: number;
  /** Number of concurrent checks (default: 1) */
  concurrency?: number;
  /** Description for error messages */
  description?: string;
}

export interface AlwaysResult {
  /** Whether the condition was always true */
  success: boolean;
  /** Total monitoring duration in ms */
  duration: number;
  /** Number of checks performed */
  checkCount: number;
  /** Number of successful checks */
  successfulChecks: number;
  /** The timestamp when the first violation occurred */
  firstViolationAt?: number;
  /** The check number where first violation occurred */
  firstViolationCheck?: number;
  /** Error message if a violation occurred */
  error?: string;
  /** All check results */
  checks: AlwaysCheckResult[];
}

export interface AlwaysCheckResult {
  /** Check number (1-indexed) */
  checkNumber: number;
  /** Timestamp of check */
  timestamp: number;
  /** Whether check passed */
  passed: boolean;
  /** Error if check failed */
  error?: string;
}

/**
 * Default options for always checks
 */
export const DEFAULT_ALWAYS_OPTIONS: Required<Omit<AlwaysOptions, 'description'>> = {
  duration: 1000,
  interval: 50,
  concurrency: 1,
};

/**
 * Check that a condition is always true over a period of time
 * 
 * @param predicate - Function that should always return true
 * @param options - Configuration options
 * @returns Result indicating success/failure and violation details
 * 
 * @example
 * ```typescript
 * // Verify balance never goes negative
 * const result = await always(
 *   async () => (await getBalance()) >= 0,
 *   { duration: 5000, description: 'balance invariant' }
 * );
 * ```
 */
export async function always(
  predicate: () => Promise<boolean> | boolean,
  options: AlwaysOptions = {}
): Promise<AlwaysResult> {
  const duration = options.duration ?? DEFAULT_ALWAYS_OPTIONS.duration;
  const interval = options.interval ?? DEFAULT_ALWAYS_OPTIONS.interval;
  const description = options.description ?? 'invariant';
  
  const startTime = now();
  const deadline = startTime + duration;
  const checks: AlwaysCheckResult[] = [];
  let checkNumber = 0;
  let firstViolation: { at: number; check: number; error?: string } | undefined;
  
  while (now() < deadline) {
    checkNumber++;
    const checkTime = now();
    
    try {
      const result = await predicate();
      
      if (result !== true) {
        // Violation detected
        if (!firstViolation) {
          firstViolation = { 
            at: checkTime, 
            check: checkNumber,
            error: `${description} returned false at check #${checkNumber}`,
          };
        }
        
        checks.push({
          checkNumber,
          timestamp: checkTime,
          passed: false,
          error: `Returned false`,
        });
        
        // Fail fast on first violation
        break;
      }
      
      checks.push({
        checkNumber,
        timestamp: checkTime,
        passed: true,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (!firstViolation) {
        firstViolation = {
          at: checkTime,
          check: checkNumber,
          error: `${description} threw at check #${checkNumber}: ${errorMsg}`,
        };
      }
      
      checks.push({
        checkNumber,
        timestamp: checkTime,
        passed: false,
        error: errorMsg,
      });
      
      // Fail fast on error
      break;
    }
    
    // Wait for next check, but don't overshoot deadline
    const remaining = deadline - now();
    if (remaining > interval) {
      await sleep(interval);
    } else if (remaining > 0) {
      await sleep(remaining);
    }
  }
  
  const actualDuration = now() - startTime;
  const successfulChecks = checks.filter(c => c.passed).length;
  
  if (firstViolation) {
    return {
      success: false,
      duration: actualDuration,
      checkCount: checks.length,
      successfulChecks,
      firstViolationAt: firstViolation.at,
      firstViolationCheck: firstViolation.check,
      error: firstViolation.error,
      checks,
    };
  }
  
  return {
    success: true,
    duration: actualDuration,
    checkCount: checks.length,
    successfulChecks,
    checks,
  };
}

/**
 * Check with duration units
 */
export async function alwaysFor(
  predicate: () => Promise<boolean> | boolean,
  value: number,
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days',
  options: Omit<AlwaysOptions, 'duration'> = {}
): Promise<AlwaysResult> {
  const duration = toMilliseconds(value, unit);
  return always(predicate, { ...options, duration });
}

/**
 * Check that a condition is always true across N executions
 * (not time-based, but count-based)
 */
export async function alwaysN(
  predicate: () => Promise<boolean> | boolean,
  count: number,
  options: Pick<AlwaysOptions, 'concurrency' | 'description'> = {}
): Promise<AlwaysResult> {
  const description = options.description ?? 'invariant';
  const startTime = now();
  const checks: AlwaysCheckResult[] = [];
  let firstViolation: { at: number; check: number; error?: string } | undefined;
  
  for (let i = 1; i <= count; i++) {
    const checkTime = now();
    
    try {
      const result = await predicate();
      
      if (result !== true) {
        if (!firstViolation) {
          firstViolation = {
            at: checkTime,
            check: i,
            error: `${description} returned false at check #${i}`,
          };
        }
        
        checks.push({
          checkNumber: i,
          timestamp: checkTime,
          passed: false,
          error: 'Returned false',
        });
        
        break;
      }
      
      checks.push({
        checkNumber: i,
        timestamp: checkTime,
        passed: true,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (!firstViolation) {
        firstViolation = {
          at: checkTime,
          check: i,
          error: `${description} threw at check #${i}: ${errorMsg}`,
        };
      }
      
      checks.push({
        checkNumber: i,
        timestamp: checkTime,
        passed: false,
        error: errorMsg,
      });
      
      break;
    }
  }
  
  const duration = now() - startTime;
  const successfulChecks = checks.filter(c => c.passed).length;
  
  if (firstViolation) {
    return {
      success: false,
      duration,
      checkCount: checks.length,
      successfulChecks,
      firstViolationAt: firstViolation.at,
      firstViolationCheck: firstViolation.check,
      error: firstViolation.error,
      checks,
    };
  }
  
  return {
    success: true,
    duration,
    checkCount: checks.length,
    successfulChecks,
    checks,
  };
}

/**
 * Create an always checker with preset options
 */
export function createAlwaysChecker(defaultOptions: AlwaysOptions) {
  return async (
    predicate: () => Promise<boolean> | boolean,
    options: AlwaysOptions = {}
  ): Promise<AlwaysResult> => {
    return always(predicate, { ...defaultOptions, ...options });
  };
}

/**
 * Format always result as readable report
 */
export function formatAlwaysResult(result: AlwaysResult): string {
  const status = result.success ? '✓ PASS' : '✗ FAIL';
  const lines = [
    `${status}: Invariant check`,
    `  Duration: ${formatDuration(result.duration)}`,
    `  Checks: ${result.successfulChecks}/${result.checkCount} passed`,
  ];
  
  if (!result.success && result.firstViolationCheck !== undefined) {
    lines.push(`  First violation: check #${result.firstViolationCheck}`);
  }
  
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }
  
  return lines.join('\n');
}

/**
 * Assert that a condition is always true
 * Throws if any violation is detected
 */
export async function assertAlways(
  predicate: () => Promise<boolean> | boolean,
  options: AlwaysOptions = {}
): Promise<AlwaysResult> {
  const result = await always(predicate, options);
  
  if (!result.success) {
    const error = new Error(result.error);
    error.name = 'InvariantViolationError';
    throw error;
  }
  
  return result;
}

/**
 * Monitor multiple invariants simultaneously
 */
export async function alwaysAll(
  invariants: Array<{
    predicate: () => Promise<boolean> | boolean;
    description?: string;
  }>,
  options: AlwaysOptions = {}
): Promise<{
  success: boolean;
  results: AlwaysResult[];
  totalDuration: number;
}> {
  const startTime = now();
  
  // Run all invariant checks in parallel
  const results = await Promise.all(
    invariants.map(inv => 
      always(inv.predicate, { ...options, description: inv.description })
    )
  );
  
  return {
    success: results.every(r => r.success),
    results,
    totalDuration: now() - startTime,
  };
}
