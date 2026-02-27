// ============================================================================
// ISL Standard Library - Retry Middleware
// @isl-lang/stdlib-api
// ============================================================================

import type { Middleware } from '../types.js';
import { isRetryableStatus } from '../errors.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatusCodes?: number[];
  retryOnErrorKinds?: string[];
  jitter?: boolean;
  /** Inject clock for deterministic testing. Returns a Promise that resolves after ms. */
  delayFn?: (ms: number) => Promise<void>;
  /** Inject random for deterministic jitter testing. Returns [0, 1). */
  randomFn?: () => number;
}

const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30_000;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute exponential backoff delay with optional jitter.
 */
export function computeDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean,
  randomFn: () => number,
): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  if (!jitter) return capped;
  // Full jitter: uniform random in [0, capped]
  return Math.floor(randomFn() * capped);
}

/**
 * Parse Retry-After header. Returns delay in ms, or undefined if not parseable.
 */
export function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  // Retry-After can be seconds (integer) or HTTP-date
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  // Try parsing as date
  const date = Date.parse(value);
  if (!isNaN(date)) {
    const delayMs = date - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }
  return undefined;
}

/**
 * Retry middleware with exponential backoff + jitter.
 * Respects Retry-After header when present.
 */
export function retryMiddleware(options: RetryOptions): Middleware {
  const {
    maxRetries,
    baseDelayMs = DEFAULT_BASE_DELAY,
    maxDelayMs = DEFAULT_MAX_DELAY,
    retryOnStatusCodes,
    retryOnErrorKinds,
    jitter = true,
    delayFn = defaultDelay,
    randomFn = Math.random,
  } = options;

  return {
    name: 'retry',
    async execute(ctx, next) {
      let lastResult = await next(ctx);

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (lastResult.ok) return lastResult;

        const error = lastResult.error;

        // Check if this error is retryable
        const shouldRetry = isErrorRetryable(error, retryOnStatusCodes, retryOnErrorKinds);
        if (!shouldRetry) return lastResult;

        // Compute delay, respecting Retry-After if available
        let delay: number;
        if (error.kind === 'HttpError' && error.status === 429) {
          // Check for Retry-After in metadata (set by the response)
          const retryAfterMs = ctx.metadata['retryAfterMs'] as number | undefined;
          delay = retryAfterMs ?? computeDelay(attempt, baseDelayMs, maxDelayMs, jitter, randomFn);
        } else {
          delay = computeDelay(attempt, baseDelayMs, maxDelayMs, jitter, randomFn);
        }

        await delayFn(delay);

        // Store attempt count in metadata for observability
        ctx.metadata['retryAttempt'] = attempt + 1;

        lastResult = await next(ctx);
      }

      return lastResult;
    },
  };
}

function isErrorRetryable(
  error: { kind: string; status?: number; retryable: boolean },
  statusCodes?: number[],
  errorKinds?: string[],
): boolean {
  // Custom status code list takes precedence
  if (statusCodes && error.status !== undefined) {
    return statusCodes.includes(error.status);
  }

  // Custom error kind list
  if (errorKinds) {
    return errorKinds.includes(error.kind);
  }

  // Default: use the retryable flag + built-in retryable statuses
  if (error.retryable) return true;
  if (error.status !== undefined) return isRetryableStatus(error.status);

  return false;
}
