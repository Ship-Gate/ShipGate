import { Clock, Random } from '../types';
import { CircuitState, CircuitBreakerOptions, CircuitBreakerMetrics } from './types';
import { createIdempotencyError, IdempotencyErrorCode } from '../errors';

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private rejections = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private failureTimes: Date[] = [];

  constructor(
    private clock: Clock,
    private random: Random,
    private options: CircuitBreakerOptions
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.clock.now() < this.nextAttemptTime!) {
        this.rejections++;
        throw createIdempotencyError(
          IdempotencyErrorCode.CONCURRENT_REQUEST,
          'Circuit breaker is OPEN',
          { state: this.state, nextAttempt: this.nextAttemptTime }
        );
      }
      
      // Try to transition to half-open
      this.transitionToHalfOpen();
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

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      rejections: this.rejections,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.rejections = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.failureTimes = [];
  }

  /**
   * Force circuit breaker to open state
   */
  trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(
      this.clock.now().getTime() + this.options.recoveryTimeout
    );
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = this.clock.now();
    this.successes++;

    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = Math.max(0, this.failures - 1);
        this.failureTimes = [];
        break;

      case CircuitState.HALF_OPEN:
        // Check if we should close the circuit
        const successThreshold = this.options.successThreshold || 1;
        if (this.successes >= successThreshold) {
          this.transitionToClosed();
        }
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    const now = this.clock.now();
    this.lastFailureTime = now;
    this.failures++;
    this.failureTimes.push(now);

    // Clean old failures outside window
    if (this.options.failureWindow) {
      const windowStart = new Date(now.getTime() - this.options.failureWindow);
      this.failureTimes = this.failureTimes.filter(t => t >= windowStart);
    }

    switch (this.state) {
      case CircuitState.CLOSED:
        // Check if we should open the circuit
        const failureThreshold = this.options.failureThreshold;
        const failureCount = this.options.failureWindow 
          ? this.failureTimes.length 
          : this.failures;

        if (failureCount >= failureThreshold) {
          this.transitionToOpen();
        }
        break;

      case CircuitState.HALF_OPEN:
        // Immediately open on failure in half-open state
        this.transitionToOpen();
        break;
    }
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;
    this.failureTimes = [];
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(
      this.clock.now().getTime() + this.options.recoveryTimeout
    );
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Get failure rate in the current window
   */
  getFailureRate(): number {
    const totalAttempts = this.failures + this.successes;
    if (totalAttempts === 0) return 0;
    return this.failures / totalAttempts;
  }

  /**
   * Create circuit breaker with default options
   */
  static withDefaults(
    clock: Clock,
    random: Random,
    overrides: Partial<CircuitBreakerOptions> = {}
  ): CircuitBreaker {
    const defaults: CircuitBreakerOptions = {
      failureThreshold: 5,
      failureWindow: 60000, // 1 minute
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 2,
      trackTimeouts: true
    };
    
    return new CircuitBreaker(clock, random, { ...defaults, ...overrides });
  }
}
