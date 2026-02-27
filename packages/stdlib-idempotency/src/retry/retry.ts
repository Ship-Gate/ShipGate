import { Clock, Random } from '../types';
import { RetryOptions, RetryResult, RetryCondition } from './types';
import { ExponentialBackoff, BackoffStrategy } from './strategies';

/**
 * Retry utility with configurable backoff strategies
 */
export class Retry {
  private backoffStrategy: BackoffStrategy;

  constructor(
    private clock: Clock,
    private random: Random,
    private options: RetryOptions
  ) {
    this.backoffStrategy = new ExponentialBackoff(
      options.multiplier || 2,
      options.jitter || 0.1,
      random
    );
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    condition?: RetryCondition
  ): Promise<RetryResult<T>> {
    const startTime = this.clock.now().getTime();
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const result = await fn();
        const totalTime = this.clock.now().getTime() - startTime;
        
        return {
          success: true,
          result,
          attempts: attempt,
          totalTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        if (attempt === this.options.maxAttempts) {
          break;
        }
        
        if (condition && !condition.shouldRetry(lastError)) {
          break;
        }
        
        if (!this.options.retryNonRetryable && this.isNonRetryable(lastError)) {
          break;
        }
        
        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    const totalTime = this.clock.now().getTime() - startTime;
    
    return {
      success: false,
      error: lastError,
      attempts: this.options.maxAttempts,
      totalTime
    };
  }

  /**
   * Execute function with custom backoff strategy
   */
  async executeWithBackoff<T>(
    fn: () => Promise<T>,
    backoff: BackoffStrategy,
    condition?: RetryCondition
  ): Promise<RetryResult<T>> {
    const originalStrategy = this.backoffStrategy;
    this.backoffStrategy = backoff;
    
    try {
      return await this.execute(fn, condition);
    } finally {
      this.backoffStrategy = originalStrategy;
    }
  }

  /**
   * Calculate delay for attempt
   */
  private calculateDelay(attempt: number): number {
    const delay = this.backoffStrategy.calculate(attempt, this.options.initialDelay);
    
    if (this.options.maxDelay) {
      return Math.min(delay, this.options.maxDelay);
    }
    
    return delay;
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryable(error: Error): boolean {
    // HTTP 4xx errors (except 429) are generally non-retryable
    if ('statusCode' in error) {
      const status = (error as any).statusCode;
      return status >= 400 && status < 500 && status !== 429;
    }
    
    // Authentication/authorization errors are non-retryable
    const message = error.message.toLowerCase();
    if (message.includes('unauthorized') || 
        message.includes('forbidden') ||
        message.includes('authentication')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry instance with default options
   */
  static withDefaults(
    clock: Clock,
    random: Random,
    overrides: Partial<RetryOptions> = {}
  ): Retry {
    const defaults: RetryOptions = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: 0.1,
      retryNonRetryable: false
    };
    
    return new Retry(clock, random, { ...defaults, ...overrides });
  }
}
