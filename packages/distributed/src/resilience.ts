/**
 * ISL Resilience Patterns
 * 
 * Circuit breakers, retries, bulkheads, and rate limiters
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  RetryPolicy,
  BulkheadConfig,
  RateLimiterConfig,
} from './types';

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    successes: 0,
  };

  constructor(
    private config: CircuitBreakerConfig,
    private name: string = 'circuit-breaker'
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'open') {
      if (this.state.nextAttempt && Date.now() < this.state.nextAttempt) {
        throw new CircuitOpenError(this.name);
      }
      // Transition to half-open
      this.state.state = 'half-open';
      this.state.successes = 0;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a success
   */
  private recordSuccess(): void {
    this.state.successes++;
    this.state.lastSuccess = Date.now();

    if (this.state.state === 'half-open') {
      if (this.state.successes >= this.config.successThreshold) {
        // Close the circuit
        this.state.state = 'closed';
        this.state.failures = 0;
      }
    } else if (this.state.state === 'closed') {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();

    if (this.state.state === 'half-open') {
      // Open the circuit
      this.state.state = 'open';
      this.state.nextAttempt = Date.now() + this.config.timeout;
    } else if (this.state.state === 'closed') {
      if (this.state.failures >= this.config.failureThreshold) {
        // Open the circuit
        this.state.state = 'open';
        this.state.nextAttempt = Date.now() + this.config.timeout;
      }
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      successes: 0,
    };
  }
}

/**
 * Circuit open error
 */
export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is open`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Retry with policy
 */
export async function retry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy
): Promise<T> {
  let lastError: Error | undefined;
  let delay = policy.initialDelay;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if we should ignore this error
      if (policy.ignoreOn?.includes(lastError.name)) {
        throw lastError;
      }

      // Check if we should retry this error
      if (policy.retryOn && !policy.retryOn.includes(lastError.name)) {
        throw lastError;
      }

      if (attempt < policy.maxAttempts) {
        await sleep(delay);

        // Calculate next delay
        switch (policy.backoff) {
          case 'exponential':
            delay = Math.min(delay * 2, policy.maxDelay ?? Infinity);
            break;
          case 'linear':
            delay = Math.min(delay + policy.initialDelay, policy.maxDelay ?? Infinity);
            break;
          // 'fixed' - keep the same delay
        }
      }
    }
  }

  throw lastError ?? new Error('Retry failed');
}

/**
 * Bulkhead implementation
 */
export class Bulkhead {
  private running = 0;
  private queue: Array<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    fn: () => Promise<unknown>;
  }> = [];

  constructor(
    private config: BulkheadConfig,
    private name: string = 'bulkhead'
  ) {}

  /**
   * Execute a function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.config.maxConcurrent) {
      return this.run(fn);
    }

    if (this.queue.length >= this.config.maxQueue) {
      throw new BulkheadRejectError(this.name);
    }

    return new Promise<T>((resolve, reject) => {
      const item = {
        resolve: resolve as (value: unknown) => void,
        reject,
        fn: fn as () => Promise<unknown>,
      };

      // Add timeout if configured
      if (this.config.timeout) {
        setTimeout(() => {
          const index = this.queue.indexOf(item);
          if (index >= 0) {
            this.queue.splice(index, 1);
            reject(new BulkheadTimeoutError(this.name, this.config.timeout!));
          }
        }, this.config.timeout);
      }

      this.queue.push(item);
    });
  }

  /**
   * Run a function
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Process queued items
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.config.maxConcurrent) {
      const item = this.queue.shift()!;
      this.run(item.fn)
        .then(item.resolve)
        .catch(item.reject);
    }
  }

  /**
   * Get current stats
   */
  getStats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

/**
 * Bulkhead reject error
 */
export class BulkheadRejectError extends Error {
  constructor(name: string) {
    super(`Bulkhead '${name}' is full`);
    this.name = 'BulkheadRejectError';
  }
}

/**
 * Bulkhead timeout error
 */
export class BulkheadTimeoutError extends Error {
  constructor(name: string, timeout: number) {
    super(`Bulkhead '${name}' queue timeout after ${timeout}ms`);
    this.name = 'BulkheadTimeoutError';
  }
}

/**
 * Rate limiter implementation (token bucket)
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.limit;
    this.lastRefill = Date.now();
  }

  /**
   * Try to acquire a token
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    while (!this.tryAcquire()) {
      await sleep(this.config.window / this.config.limit);
    }
  }

  /**
   * Execute with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillAmount = (elapsed / this.config.window) * this.config.limit;

    this.tokens = Math.min(
      this.tokens + refillAmount,
      this.config.burst ?? this.config.limit
    );
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Combine multiple resilience patterns
 */
export function withResilience<T>(
  fn: () => Promise<T>,
  options: {
    circuitBreaker?: CircuitBreaker;
    retry?: RetryPolicy;
    bulkhead?: Bulkhead;
    rateLimiter?: RateLimiter;
    timeout?: number;
  }
): Promise<T> {
  let wrapped = fn;

  // Apply timeout
  if (options.timeout) {
    const originalFn = wrapped;
    wrapped = () => Promise.race([
      originalFn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${options.timeout}ms`)), options.timeout)
      ),
    ]);
  }

  // Apply retry
  if (options.retry) {
    const originalFn = wrapped;
    wrapped = () => retry(originalFn, options.retry!);
  }

  // Apply circuit breaker
  if (options.circuitBreaker) {
    const originalFn = wrapped;
    wrapped = () => options.circuitBreaker!.execute(originalFn);
  }

  // Apply bulkhead
  if (options.bulkhead) {
    const originalFn = wrapped;
    wrapped = () => options.bulkhead!.execute(originalFn);
  }

  // Apply rate limiter
  if (options.rateLimiter) {
    const originalFn = wrapped;
    wrapped = () => options.rateLimiter!.execute(originalFn);
  }

  return wrapped();
}
