/**
 * Shared Retry Logic
 *
 * Canonical retry / backoff engine shared across all SDK targets.
 * Supports linear and exponential backoff with jitter.
 */

import type { RetryConfig } from './types.js';
import { DEFAULT_RETRY } from './types.js';

// ============================================================================
// Delay Calculation
// ============================================================================

/**
 * Calculate the delay for a given retry attempt.
 * @param attempt 1-indexed attempt number
 * @param config  retry configuration
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const { baseDelay, maxDelay, backoff } = config;

  if (backoff === 'linear') {
    return Math.min(baseDelay * attempt, maxDelay);
  }

  // Exponential backoff with ±10 % jitter
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
}

// ============================================================================
// Retry Executor
// ============================================================================

export interface RetryResult<T> {
  /** Final successful value (undefined when all attempts exhausted) */
  value?: T;
  /** Last error if all attempts failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
}

/**
 * Execute `fn` with automatic retries according to `config`.
 *
 * @param fn        async function to execute
 * @param config    retry config (defaults to DEFAULT_RETRY)
 * @param shouldRetry  optional predicate; return false to abort early
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
  shouldRetry?: (error: unknown, attempt: number) => boolean,
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    attempt++;
    try {
      const value = await fn(attempt);
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (shouldRetry && !shouldRetry(err, attempt)) {
        break;
      }

      if (attempt < config.maxAttempts) {
        await sleep(calculateRetryDelay(attempt, config));
      }
    }
  }

  return { error: lastError, attempts: attempt };
}

/**
 * Determine if an HTTP status code is retryable given the config.
 */
export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  return config.retryableStatusCodes.includes(status);
}

// ============================================================================
// Helpers
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
