import { Random } from '../types';
import { BackoffStrategy, RetryCondition } from './types';

/**
 * Exponential backoff with jitter
 */
export class ExponentialBackoff implements BackoffStrategy {
  constructor(
    private multiplier: number = 2,
    private jitter: number = 0.1,
    private random: Random = Math
  ) {}

  calculate(attempt: number, baseDelay: number): number {
    const exponential = baseDelay * Math.pow(this.multiplier, attempt - 1);
    const jitterRange = exponential * this.jitter;
    const jitterValue = (this.random.random() - 0.5) * 2 * jitterRange;
    
    return Math.max(0, exponential + jitterValue);
  }
}

/**
 * Linear backoff
 */
export class LinearBackoff implements BackoffStrategy {
  constructor(
    private increment: number = 1000,
    private jitter: number = 0.1,
    private random: Random = Math
  ) {}

  calculate(attempt: number, baseDelay: number): number {
    const linear = baseDelay + (attempt - 1) * this.increment;
    const jitterRange = linear * this.jitter;
    const jitterValue = (this.random.random() - 0.5) * 2 * jitterRange;
    
    return Math.max(0, linear + jitterValue);
  }
}

/**
 * Fixed delay with jitter
 */
export class FixedBackoff implements BackoffStrategy {
  constructor(
    private jitter: number = 0.1,
    private random: Random = Math
  ) {}

  calculate(attempt: number, baseDelay: number): number {
    const jitterRange = baseDelay * this.jitter;
    const jitterValue = (this.random.random() - 0.5) * 2 * jitterRange;
    
    return Math.max(0, baseDelay + jitterValue);
  }
}

/**
 * Retry conditions
 */
export class RetryConditions {
  /**
   * Retry on network errors
   */
  static networkErrors: RetryCondition = {
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')
      );
    }
  };

  /**
   * Retry on 5xx HTTP errors
   */
  static serverErrors: RetryCondition = {
    shouldRetry: (error: Error) => {
      if ('statusCode' in error) {
        const status = (error as any).statusCode;
        return status >= 500 && status < 600;
      }
      return false;
    }
  };

  /**
   * Retry on rate limit errors (429)
   */
  static rateLimit: RetryCondition = {
    shouldRetry: (error: Error) => {
      if ('statusCode' in error) {
        return (error as any).statusCode === 429;
      }
      return false;
    }
  };

  /**
   * Retry on idempotency conflicts
   */
  static idempotencyConflict: RetryCondition = {
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('concurrent') ||
        message.includes('conflict') ||
        message.includes('lock') ||
        message.includes('409')
      );
    }
  };

  /**
   * Combine multiple conditions with OR logic
   */
  static any(...conditions: RetryCondition[]): RetryCondition {
    return {
      shouldRetry: (error: Error) => {
        return conditions.some(condition => condition.shouldRetry(error));
      }
    };
  }

  /**
   * Combine multiple conditions with AND logic
   */
  static all(...conditions: RetryCondition[]): RetryCondition {
    return {
      shouldRetry: (error: Error) => {
        return conditions.every(condition => condition.shouldRetry(error));
      }
    };
  }

  /**
   * Negate a condition
   */
  static not(condition: RetryCondition): RetryCondition {
    return {
      shouldRetry: (error: Error) => !condition.shouldRetry(error)
    };
  }

  /**
   * Always retry
   */
  static always: RetryCondition = {
    shouldRetry: () => true
  };

  /**
   * Never retry
   */
  static never: RetryCondition = {
    shouldRetry: () => false
  };
}
