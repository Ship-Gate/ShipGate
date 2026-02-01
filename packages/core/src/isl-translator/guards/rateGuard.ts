/**
 * Rate Guard - Request rate limiting for LLM calls
 *
 * Implements a sliding window rate limiter to control
 * the number of requests per time window.
 */

import type {
  Clock,
  RateGuard,
  RateGuardConfig,
  GuardResult,
  GuardUsage,
  GuardEvent,
  GuardEventListener,
} from './guardTypes.js';

import { realClock, TIME } from './guardTypes.js';

/**
 * Create a rate guard with the given configuration
 *
 * @param config - Rate guard configuration
 * @returns RateGuard instance
 *
 * @example
 * ```typescript
 * // Allow 10 requests per minute
 * const guard = createRateGuard({ maxRequests: 10 });
 *
 * // Check before making a request
 * const result = guard.check();
 * if (result.allowed) {
 *   await makeLLMCall();
 *   guard.record();
 * } else {
 *   console.log(`Rate limited. Retry after ${result.retryAfterMs}ms`);
 * }
 * ```
 */
export function createRateGuard(config: RateGuardConfig): RateGuard & {
  onEvent(listener: GuardEventListener): () => void;
} {
  const {
    maxRequests,
    windowMs = TIME.MINUTE,
    clock = realClock,
  } = config;

  // Validate config
  if (maxRequests <= 0) {
    throw new Error('maxRequests must be positive');
  }
  if (windowMs <= 0) {
    throw new Error('windowMs must be positive');
  }

  // Request timestamps within the current window
  let requestTimestamps: number[] = [];
  let listeners: GuardEventListener[] = [];

  function emit(event: Omit<GuardEvent, 'timestamp' | 'guardType'>): void {
    const fullEvent: GuardEvent = {
      ...event,
      timestamp: clock.now(),
      guardType: 'rate',
    };
    for (const listener of listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Ignore listener errors
      }
    }
  }

  function pruneOldRequests(): void {
    const now = clock.now();
    const windowStart = now - windowMs;
    requestTimestamps = requestTimestamps.filter((ts) => ts > windowStart);
  }

  function getWindowResetTime(): number {
    if (requestTimestamps.length === 0) {
      return clock.now() + windowMs;
    }
    // Window resets when oldest request falls out
    return requestTimestamps[0] + windowMs;
  }

  return {
    check(): GuardResult {
      pruneOldRequests();
      const now = clock.now();
      const currentCount = requestTimestamps.length;

      if (currentCount >= maxRequests) {
        // Calculate when the oldest request will expire
        const oldestTimestamp = requestTimestamps[0];
        const retryAfterMs = oldestTimestamp + windowMs - now;

        emit({
          type: 'rate_limited',
          details: {
            currentCount,
            maxRequests,
            retryAfterMs,
          },
        });

        return {
          allowed: false,
          reason: `Rate limit exceeded: ${currentCount}/${maxRequests} requests in window`,
          retryAfterMs: Math.max(0, retryAfterMs),
          usage: {
            current: currentCount,
            limit: maxRequests,
            resetsAt: getWindowResetTime(),
            percentUsed: (currentCount / maxRequests) * 100,
          },
        };
      }

      emit({
        type: 'request_allowed',
        details: {
          currentCount,
          maxRequests,
          remaining: maxRequests - currentCount,
        },
      });

      return {
        allowed: true,
        usage: {
          current: currentCount,
          limit: maxRequests,
          resetsAt: getWindowResetTime(),
          percentUsed: (currentCount / maxRequests) * 100,
        },
      };
    },

    record(): void {
      pruneOldRequests();
      requestTimestamps.push(clock.now());

      emit({
        type: 'request_recorded',
        details: {
          totalInWindow: requestTimestamps.length,
          maxRequests,
        },
      });
    },

    getUsage(): GuardUsage {
      pruneOldRequests();
      const currentCount = requestTimestamps.length;
      return {
        current: currentCount,
        limit: maxRequests,
        resetsAt: getWindowResetTime(),
        percentUsed: (currentCount / maxRequests) * 100,
      };
    },

    reset(): void {
      requestTimestamps = [];
    },

    onEvent(listener: GuardEventListener): () => void {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
}

/**
 * Pre-configured rate guards for common use cases
 */
export const RateGuardPresets = {
  /** Conservative: 5 requests per minute */
  conservative: (clock?: Clock) =>
    createRateGuard({ maxRequests: 5, windowMs: TIME.MINUTE, clock }),

  /** Standard: 20 requests per minute */
  standard: (clock?: Clock) =>
    createRateGuard({ maxRequests: 20, windowMs: TIME.MINUTE, clock }),

  /** Aggressive: 60 requests per minute */
  aggressive: (clock?: Clock) =>
    createRateGuard({ maxRequests: 60, windowMs: TIME.MINUTE, clock }),

  /** Burst: 10 requests per 10 seconds */
  burst: (clock?: Clock) =>
    createRateGuard({ maxRequests: 10, windowMs: 10 * TIME.SECOND, clock }),
} as const;
