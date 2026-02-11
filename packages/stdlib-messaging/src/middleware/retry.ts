/**
 * Retry middleware
 */

import type { Middleware, ProduceContext, ConsumeContext } from '../types.js';
import type { HandlerResult } from '../types.js';
import { BackoffCalculator, BackoffType } from '../dead-letter/policy.js';

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Backoff policy */
  backoffPolicy: {
    type: BackoffType;
    initialDelay: number;
    maxDelay: number;
    multiplier?: number;
    jitter?: number;
  };
  
  /** Conditions for retry */
  retryCondition?: (error: Error, attempt: number) => boolean;
  
  /** Retry on specific error types */
  retryableErrors?: string[];
  
  /** Don't retry on specific error types */
  nonRetryableErrors?: string[];
  
  /** Whether to retry on timeout */
  retryOnTimeout?: boolean;
}

// ============================================================================
// RETRY MIDDLEWARE
// ============================================================================

export class RetryMiddleware implements Middleware {
  readonly name = 'retry';
  
  constructor(private readonly config: RetryConfig) {}
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        await next();
        return; // Success, no retry needed
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (attempt === this.config.maxAttempts || !this.shouldRetry(error as Error, attempt)) {
          throw error;
        }
        
        // Calculate delay and wait
        const delay = BackoffCalculator.calculateDelay(
          this.config.backoffPolicy,
          attempt - 1
        );
        
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    throw lastError!;
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await next();
        return result; // Success, no retry needed
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (attempt === this.config.maxAttempts || !this.shouldRetry(error as Error, attempt)) {
          throw error;
        }
        
        // Calculate delay and wait
        const delay = BackoffCalculator.calculateDelay(
          this.config.backoffPolicy,
          attempt - 1
        );
        
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    throw lastError!;
  }
  
  private shouldRetry(error: Error, attempt: number): boolean {
    // Check custom retry condition
    if (this.config.retryCondition && !this.config.retryCondition(error, attempt)) {
      return false;
    }
    
    // Check error name/code against lists
    const errorName = error.name;
    const errorCode = (error as any).code;
    
    // Don't retry on non-retryable errors
    if (this.config.nonRetryableErrors?.includes(errorName) || 
        this.config.nonRetryableErrors?.includes(errorCode)) {
      return false;
    }
    
    // Retry on specific retryable errors
    if (this.config.retryableErrors?.length) {
      return this.config.retryableErrors.includes(errorName) || 
             this.config.retryableErrors.includes(errorCode);
    }
    
    // Default retryable errors
    const defaultRetryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMITED',
    ];
    
    if (defaultRetryableErrors.includes(errorName) || 
        defaultRetryableErrors.includes(errorCode)) {
      return true;
    }
    
    // Check for timeout errors
    if (this.config.retryOnTimeout && 
        (errorName.includes('timeout') || errorCode?.includes('timeout'))) {
      return true;
    }
    
    // Default: don't retry on unknown errors
    return false;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  
  /** Time window for failure counting (ms) */
  failureWindow: number;
  
  /** How long to keep circuit open (ms) */
  openTimeout: number;
  
  /** Number of successful attempts to close circuit */
  recoveryThreshold: number;
  
  /** Percentage of failures to trigger circuit */
  failureRateThreshold?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures: number[] = [];
  private lastFailureTime = 0;
  private successes = 0;
  
  constructor(private readonly config: CircuitBreakerConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.openTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.recoveryThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = [];
      }
    } else {
      // Clear old failures
      const now = Date.now();
      this.failures = this.failures.filter(f => now - f < this.config.failureWindow);
    }
  }
  
  private onFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    
    // Clean old failures
    this.failures = this.failures.filter(f => now - f < this.config.failureWindow);
    
    // Check if should open circuit
    const shouldOpen = this.config.failureRateThreshold
      ? this.failures.length >= this.config.failureThreshold && 
        (this.failures.length / this.config.failureWindow) * 100 >= this.config.failureRateThreshold
      : this.failures.length >= this.config.failureThreshold;
    
    if (shouldOpen) {
      this.state = CircuitState.OPEN;
      this.lastFailureTime = now;
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.lastFailureTime = now;
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getFailureCount(): number {
    const now = Date.now();
    return this.failures.filter(f => now - f < this.config.failureWindow).length;
  }
}

// ============================================================================
// CIRCUIT BREAKER MIDDLEWARE
// ============================================================================

export class CircuitBreakerMiddleware implements Middleware {
  readonly name = 'circuit-breaker';
  
  private readonly producers = new Map<string, CircuitBreaker>();
  private readonly consumers = new Map<string, CircuitBreaker>();
  
  constructor(private readonly config: CircuitBreakerConfig) {}
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    let breaker = this.producers.get(context.queue);
    
    if (!breaker) {
      breaker = new CircuitBreaker(this.config);
      this.producers.set(context.queue, breaker);
    }
    
    await breaker.execute(next);
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    let breaker = this.consumers.get(context.queue);
    
    if (!breaker) {
      breaker = new CircuitBreaker(this.config);
      this.consumers.set(context.queue, breaker);
    }
    
    return breaker.execute(next);
  }
  
  /**
   * Get circuit breaker state for a producer
   */
  getProducerState(queue: string): CircuitState {
    const breaker = this.producers.get(queue);
    return breaker?.getState() || CircuitState.CLOSED;
  }
  
  /**
   * Get circuit breaker state for a consumer
   */
  getConsumerState(queue: string): CircuitState {
    const breaker = this.consumers.get(queue);
    return breaker?.getState() || CircuitState.CLOSED;
  }
  
  /**
   * Reset all circuit breakers
   */
  reset(): void {
    this.producers.clear();
    this.consumers.clear();
  }
}

// ============================================================================
// BULKHEAD PATTERN
// ============================================================================

export interface BulkheadConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;
  
  /** Maximum queue size for pending executions */
  maxQueue?: number;
}

export class Bulkhead {
  private running = 0;
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  
  constructor(private readonly config: BulkheadConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check queue limit
      if (this.config.maxQueue && this.queue.length >= this.config.maxQueue) {
        reject(new Error('Bulkhead queue is full'));
        return;
      }
      
      // Add to queue
      this.queue.push({ resolve: () => this.run(fn, resolve, reject), reject });
      this.process();
    });
  }
  
  private async run<T>(
    fn: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    this.running++;
    
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error as Error);
    } finally {
      this.running--;
      this.process();
    }
  }
  
  private process(): void {
    if (this.running >= this.config.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    }
  }
  
  getStats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

// ============================================================================
// BULKHEAD MIDDLEWARE
// ============================================================================

export class BulkheadMiddleware implements Middleware {
  readonly name = 'bulkhead';
  
  private readonly producers = new Map<string, Bulkhead>();
  private readonly consumers = new Map<string, Bulkhead>();
  
  constructor(private readonly config: BulkheadConfig) {}
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    let bulkhead = this.producers.get(context.queue);
    
    if (!bulkhead) {
      bulkhead = new Bulkhead(this.config);
      this.producers.set(context.queue, bulkhead);
    }
    
    await bulkhead.execute(next);
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    let bulkhead = this.consumers.get(context.queue);
    
    if (!bulkhead) {
      bulkhead = new Bulkhead(this.config);
      this.consumers.set(context.queue, bulkhead);
    }
    
    return bulkhead.execute(next);
  }
  
  /**
   * Get bulkhead stats for a producer
   */
  getProducerStats(queue: string): { running: number; queued: number } {
    const bulkhead = this.producers.get(queue);
    return bulkhead?.getStats() || { running: 0, queued: 0 };
  }
  
  /**
   * Get bulkhead stats for a consumer
   */
  getConsumerStats(queue: string): { running: number; queued: number } {
    const bulkhead = this.consumers.get(queue);
    return bulkhead?.getStats() || { running: 0, queued: 0 };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a retry middleware with exponential backoff
 */
export function createRetryMiddleware(
  maxAttempts: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 30000
): RetryMiddleware {
  return new RetryMiddleware({
    maxAttempts,
    backoffPolicy: {
      type: BackoffType.EXPONENTIAL,
      initialDelay,
      maxDelay,
      multiplier: 2,
      jitter: 0.1,
    },
  });
}

/**
 * Create a retry middleware with custom configuration
 */
export function createCustomRetryMiddleware(config: RetryConfig): RetryMiddleware {
  return new RetryMiddleware(config);
}

/**
 * Create a circuit breaker middleware
 */
export function createCircuitBreakerMiddleware(
  failureThreshold: number = 5,
  failureWindow: number = 60000,
  openTimeout: number = 30000
): CircuitBreakerMiddleware {
  return new CircuitBreakerMiddleware({
    failureThreshold,
    failureWindow,
    openTimeout,
    recoveryThreshold: 3,
  });
}

/**
 * Create a bulkhead middleware
 */
export function createBulkheadMiddleware(
  maxConcurrent: number = 10,
  maxQueue: number = 100
): BulkheadMiddleware {
  return new BulkheadMiddleware({
    maxConcurrent,
    maxQueue,
  });
}
