/**
 * Circuit Breaker Types
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  volumeThreshold?: number;
  slowCallThreshold?: number;
  slowCallDuration?: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangedAt: number;
  failureRate: number;
  slowCallRate: number;
}

export interface RetryConfig {
  maxRetries: number;
  backoff: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryOn?: (error: Error) => boolean;
}

export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueued: number;
  timeout?: number;
}

export interface RateLimiterConfig {
  name: string;
  limitForPeriod: number;
  limitRefreshPeriod: number;
  timeout?: number;
}

export interface TimeoutConfig {
  timeout: number;
  onTimeout?: () => void;
}

export interface FallbackConfig<T> {
  fallback: () => T | Promise<T>;
  shouldFallback?: (error: Error) => boolean;
}

export interface ResiliencePolicy<T> {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  bulkhead?: BulkheadConfig;
  rateLimiter?: RateLimiterConfig;
  timeout?: TimeoutConfig;
  fallback?: FallbackConfig<T>;
}

export interface BehaviorResilienceConfig {
  domain: string;
  behavior: string;
  policy: ResiliencePolicy<unknown>;
}
