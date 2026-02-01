/**
 * Resilience Policies - Combine multiple resilience patterns
 */
import type {
  ResiliencePolicy,
  RetryConfig,
  BulkheadConfig,
  RateLimiterConfig,
  BehaviorResilienceConfig,
} from './types';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

/**
 * Bulkhead implementation - Limits concurrent executions
 */
export class Bulkhead {
  private config: Required<BulkheadConfig>;
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(config: BulkheadConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.config.maxConcurrent) {
      if (this.queue.length >= this.config.maxQueued) {
        throw new BulkheadFullError(this.config.name);
      }

      await this.waitForSlot();
    }

    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.releaseSlot();
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(new BulkheadTimeoutError(this.config.name));
      }, this.config.timeout);

      this.queue.push(() => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  getStats() {
    return {
      name: this.config.name,
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueued: this.config.maxQueued,
    };
  }
}

/**
 * Rate Limiter implementation - Limits requests per period
 */
export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private tokens: number;
  private lastRefresh: number;

  constructor(config: RateLimiterConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
    this.tokens = config.limitForPeriod;
    this.lastRefresh = Date.now();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.refresh();

    if (this.tokens <= 0) {
      const waitTime = this.getWaitTime();
      if (waitTime > this.config.timeout) {
        throw new RateLimitExceededError(this.config.name);
      }
      await this.sleep(waitTime);
      this.refresh();
    }

    this.tokens--;
    return fn();
  }

  private refresh(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefresh;

    if (elapsed >= this.config.limitRefreshPeriod) {
      this.tokens = this.config.limitForPeriod;
      this.lastRefresh = now;
    }
  }

  private getWaitTime(): number {
    const elapsed = Date.now() - this.lastRefresh;
    return Math.max(0, this.config.limitRefreshPeriod - elapsed);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    this.refresh();
    return {
      name: this.config.name,
      availableTokens: this.tokens,
      limitForPeriod: this.config.limitForPeriod,
    };
  }
}

/**
 * Retry with backoff
 */
export class Retry {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      retryOn: () => true,
      ...config,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries && this.config.retryOn(lastError)) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    switch (this.config.backoff) {
      case 'fixed':
        return this.config.initialDelay;
      case 'linear':
        return Math.min(
          this.config.initialDelay * (attempt + 1),
          this.config.maxDelay
        );
      case 'exponential':
        return Math.min(
          this.config.initialDelay * Math.pow(2, attempt),
          this.config.maxDelay
        );
      default:
        return this.config.initialDelay;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Combined resilience policy executor
 */
export class ResiliencePolicyExecutor<T> {
  private circuitBreaker?: CircuitBreaker;
  private bulkhead?: Bulkhead;
  private rateLimiter?: RateLimiter;
  private retry?: Retry;
  private fallback?: () => T | Promise<T>;
  private shouldFallback?: (error: Error) => boolean;

  constructor(policy: ResiliencePolicy<T>) {
    if (policy.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(policy.circuitBreaker);
    }
    if (policy.bulkhead) {
      this.bulkhead = new Bulkhead(policy.bulkhead);
    }
    if (policy.rateLimiter) {
      this.rateLimiter = new RateLimiter(policy.rateLimiter);
    }
    if (policy.retry) {
      this.retry = new Retry(policy.retry);
    }
    if (policy.fallback) {
      this.fallback = policy.fallback.fallback;
      this.shouldFallback = policy.fallback.shouldFallback;
    }
  }

  async execute(fn: () => Promise<T>): Promise<T> {
    let wrappedFn = fn;

    // Apply rate limiter (outermost)
    if (this.rateLimiter) {
      const rateLimiter = this.rateLimiter;
      const innerFn = wrappedFn;
      wrappedFn = () => rateLimiter.execute(innerFn);
    }

    // Apply bulkhead
    if (this.bulkhead) {
      const bulkhead = this.bulkhead;
      const innerFn = wrappedFn;
      wrappedFn = () => bulkhead.execute(innerFn);
    }

    // Apply circuit breaker
    if (this.circuitBreaker) {
      const circuitBreaker = this.circuitBreaker;
      const innerFn = wrappedFn;
      wrappedFn = () => circuitBreaker.execute(innerFn);
    }

    // Apply retry (innermost)
    if (this.retry) {
      const retry = this.retry;
      const innerFn = wrappedFn;
      wrappedFn = () => retry.execute(innerFn);
    }

    try {
      return await wrappedFn();
    } catch (error) {
      // Apply fallback if configured
      if (this.fallback) {
        const shouldFallback = this.shouldFallback?.(error as Error) ?? true;
        if (shouldFallback) {
          return this.fallback();
        }
      }
      throw error;
    }
  }

  getStats() {
    return {
      circuitBreaker: this.circuitBreaker?.getStats(),
      bulkhead: this.bulkhead?.getStats(),
      rateLimiter: this.rateLimiter?.getStats(),
    };
  }
}

// Error classes
export class BulkheadFullError extends Error {
  constructor(name: string) {
    super(`Bulkhead '${name}' is full`);
    this.name = 'BulkheadFullError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(name: string) {
    super(`Timed out waiting for bulkhead '${name}'`);
    this.name = 'BulkheadTimeoutError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(name: string) {
    super(`Rate limit exceeded for '${name}'`);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Create behavior-specific resilience policy
 */
export function createBehaviorPolicy<T>(
  config: BehaviorResilienceConfig
): ResiliencePolicyExecutor<T> {
  return new ResiliencePolicyExecutor<T>({
    ...config.policy,
    circuitBreaker: config.policy.circuitBreaker
      ? {
          ...config.policy.circuitBreaker,
          name: `${config.domain}.${config.behavior}`,
        }
      : undefined,
    bulkhead: config.policy.bulkhead
      ? {
          ...config.policy.bulkhead,
          name: `${config.domain}.${config.behavior}`,
        }
      : undefined,
    rateLimiter: config.policy.rateLimiter
      ? {
          ...config.policy.rateLimiter,
          name: `${config.domain}.${config.behavior}`,
        }
      : undefined,
  });
}
