/**
 * Shadow Mode
 * 
 * Run new implementations in shadow mode alongside existing ones.
 */

import { Sampler } from '../sampling/sampler.js';
import { comparator, type CompareResult } from './compare.js';

export interface ShadowOptions<T> {
  /** Primary (production) implementation */
  primary: (...args: unknown[]) => Promise<T>;
  /** Shadow (new) implementation */
  shadow: (...args: unknown[]) => Promise<T>;
  /** Custom comparison function */
  compare?: (primary: T, shadow: T) => boolean | CompareResult;
  /** Callback when shadow result differs */
  onDifference?: (diff: ShadowDifference<T>) => void | Promise<void>;
  /** Callback on shadow error */
  onShadowError?: (error: unknown, args: unknown[]) => void | Promise<void>;
  /** Sampling rate for shadow execution (0-1) */
  sampling?: number;
  /** Timeout for shadow execution in ms */
  shadowTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ShadowDifference<T> {
  primaryResult: T;
  shadowResult: T;
  comparison: CompareResult;
  args: unknown[];
  timestamp: Date;
  duration: {
    primary: number;
    shadow: number;
  };
}

export interface ShadowResult<T> {
  result: T;
  shadowExecuted: boolean;
  shadowMatch?: boolean;
  shadowError?: unknown;
}

export interface ShadowExecutor<T> {
  execute(...args: unknown[]): Promise<ShadowResult<T>>;
  getStats(): ShadowStats;
}

export interface ShadowStats {
  totalExecutions: number;
  shadowExecutions: number;
  matches: number;
  mismatches: number;
  shadowErrors: number;
  avgPrimaryLatency: number;
  avgShadowLatency: number;
}

/**
 * Create a shadow mode executor
 * 
 * @example
 * ```typescript
 * const shadow = shadowMode({
 *   primary: originalImplementation,
 *   shadow: newImplementation,
 *   compare: (primary, shadow) => deepEqual(primary, shadow),
 *   onDifference: (diff) => {
 *     logger.warn('Shadow mode difference', diff);
 *   },
 *   sampling: 0.05,
 * });
 * 
 * // Use in production
 * const result = await shadow.execute(input);
 * ```
 */
export function shadowMode<T>(options: ShadowOptions<T>): ShadowExecutor<T> {
  const {
    primary,
    shadow,
    compare = comparator.deepEqual,
    onDifference = () => {},
    onShadowError = () => {},
    sampling = 1.0,
    shadowTimeout = 5000,
    debug = false,
  } = options;

  const sampler = new Sampler({ rate: sampling });
  
  const stats: ShadowStats = {
    totalExecutions: 0,
    shadowExecutions: 0,
    matches: 0,
    mismatches: 0,
    shadowErrors: 0,
    avgPrimaryLatency: 0,
    avgShadowLatency: 0,
  };

  let totalPrimaryLatency = 0;
  let totalShadowLatency = 0;

  return {
    async execute(...args: unknown[]): Promise<ShadowResult<T>> {
      stats.totalExecutions++;
      
      // Execute primary
      const primaryStart = performance.now();
      const primaryResult = await primary(...args);
      const primaryDuration = performance.now() - primaryStart;
      
      totalPrimaryLatency += primaryDuration;
      stats.avgPrimaryLatency = totalPrimaryLatency / stats.totalExecutions;

      // Check if we should execute shadow
      if (!sampler.shouldSample()) {
        return {
          result: primaryResult,
          shadowExecuted: false,
        };
      }

      stats.shadowExecutions++;

      // Execute shadow (with timeout)
      let shadowResult: T;
      let shadowDuration: number;
      let shadowError: unknown;

      try {
        const shadowStart = performance.now();
        shadowResult = await Promise.race([
          shadow(...args),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Shadow timeout')), shadowTimeout)
          ),
        ]) as T;
        shadowDuration = performance.now() - shadowStart;
        
        totalShadowLatency += shadowDuration;
        stats.avgShadowLatency = totalShadowLatency / stats.shadowExecutions;
      } catch (error) {
        stats.shadowErrors++;
        shadowError = error;
        
        await onShadowError(error, args);
        
        if (debug) {
          console.error('[Shadow Mode] Shadow error:', error);
        }

        return {
          result: primaryResult,
          shadowExecuted: true,
          shadowError,
        };
      }

      // Compare results
      const comparison = compare(primaryResult, shadowResult!);
      const isMatch = typeof comparison === 'boolean' 
        ? comparison 
        : comparison.equal;

      if (isMatch) {
        stats.matches++;
      } else {
        stats.mismatches++;
        
        const diff: ShadowDifference<T> = {
          primaryResult,
          shadowResult: shadowResult!,
          comparison: typeof comparison === 'boolean' 
            ? { equal: comparison, differences: [] }
            : comparison,
          args,
          timestamp: new Date(),
          duration: {
            primary: primaryDuration,
            shadow: shadowDuration!,
          },
        };

        await onDifference(diff);

        if (debug) {
          console.log('[Shadow Mode] Difference detected:', diff);
        }
      }

      return {
        result: primaryResult,
        shadowExecuted: true,
        shadowMatch: isMatch,
      };
    },

    getStats(): ShadowStats {
      return { ...stats };
    },
  };
}

/**
 * Create a shadow mode executor with automatic metrics
 */
export function shadowModeWithMetrics<T>(
  options: ShadowOptions<T> & {
    metricsPrefix?: string;
    metricsCollector?: {
      increment(name: string, labels?: Record<string, string>): void;
      histogram(name: string, value: number, labels?: Record<string, string>): void;
    };
  }
): ShadowExecutor<T> {
  const executor = shadowMode(options);
  const { metricsPrefix = 'isl_shadow_', metricsCollector } = options;

  if (!metricsCollector) {
    return executor;
  }

  // Wrap execute to add metrics
  const originalExecute = executor.execute.bind(executor);

  return {
    async execute(...args: unknown[]): Promise<ShadowResult<T>> {
      const result = await originalExecute(...args);

      metricsCollector.increment(`${metricsPrefix}executions_total`, {
        result: result.shadowMatch === undefined 
          ? 'skipped'
          : result.shadowMatch 
            ? 'match' 
            : 'mismatch',
      });

      if (result.shadowError) {
        metricsCollector.increment(`${metricsPrefix}errors_total`);
      }

      return result;
    },

    getStats: executor.getStats,
  };
}
