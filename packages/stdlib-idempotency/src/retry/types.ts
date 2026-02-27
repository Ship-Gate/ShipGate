/**
 * Types for retry and circuit breaker
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Jitter factor (0-1) */
  jitter?: number;
  /** Whether to retry on non-retryable errors */
  retryNonRetryable?: boolean;
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening */
  failureThreshold: number;
  /** Time window for failure counting */
  failureWindow?: number;
  /** How long to stay open before trying again */
  recoveryTimeout: number;
  /** Number of successful attempts to close circuit */
  successThreshold?: number;
  /** Whether to track timeouts as failures */
  trackTimeouts?: boolean;
}

export interface RetryResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result if successful */
  result?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent */
  totalTime: number;
}

export interface CircuitBreakerMetrics {
  /** Current state */
  state: CircuitState;
  /** Number of failures */
  failures: number;
  /** Number of successes */
  successes: number;
  /** Number of rejected calls */
  rejections: number;
  /** Last failure time */
  lastFailureTime?: Date;
  /** Last success time */
  lastSuccessTime?: Date;
  /** Next attempt time */
  nextAttemptTime?: Date;
}

export interface BackoffStrategy {
  /** Calculate delay for given attempt */
  calculate(attempt: number, baseDelay: number): number;
}

export interface RetryCondition {
  /** Whether to retry on this error */
  shouldRetry(error: Error): boolean;
}
