/**
 * Circuit Breaker Implementation
 */
import type { CircuitBreakerConfig, CircuitState, CircuitStats } from './types';

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private stateChangedAt: number = Date.now();
  private slowCalls = 0;
  private recentCalls: { duration: number; success: boolean; timestamp: number }[] = [];
  private executionLock: Promise<void> = Promise.resolve();

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      volumeThreshold: 10,
      slowCallThreshold: 0.5,
      slowCallDuration: 5000,
      onStateChange: () => {},
      onFailure: () => {},
      onSuccess: () => {},
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * Thread-safe: uses a lock to prevent race conditions during state transitions
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Acquire lock to ensure thread-safe state checks and transitions
    await this.executionLock;
    
    let releaseLock: () => void;
    this.executionLock = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    try {
      if (!this.canExecute()) {
        throw new CircuitOpenError(this.config.name);
      }

      const startTime = Date.now();

      try {
        const result = await this.withTimeout(fn);
        this.recordSuccess(Date.now() - startTime);
        return result;
      } catch (error) {
        this.recordFailure(error as Error, Date.now() - startTime);
        throw error;
      }
    } finally {
      releaseLock!();
    }
  }

  /**
   * Check if request can be executed
   * Must be called within execution lock for thread safety
   */
  private canExecute(): boolean {
    this.cleanupOldCalls();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (Date.now() - this.stateChangedAt >= this.config.resetTimeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return false;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitStats {
    this.cleanupOldCalls();
    const recentSuccesses = this.recentCalls.filter(c => c.success).length;
    const recentTotal = this.recentCalls.length;
    const slowCalls = this.recentCalls.filter(
      c => c.duration >= this.config.slowCallDuration
    ).length;

    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      failureRate: recentTotal > 0 ? 1 - recentSuccesses / recentTotal : 0,
      slowCallRate: recentTotal > 0 ? slowCalls / recentTotal : 0,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit
   * Note: This is a synchronous operation. For thread-safe state changes during execution,
   * use the execute() method which handles locking automatically.
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.successes = 0;
    this.slowCalls = 0;
    this.recentCalls = [];
  }

  /**
   * Force circuit open
   * Note: This is a synchronous operation. For thread-safe state changes during execution,
   * use the execute() method which handles locking automatically.
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Force circuit closed
   * Note: This is a synchronous operation. For thread-safe state changes during execution,
   * use the execute() method which handles locking automatically.
   */
  forceClosed(): void {
    this.transitionTo('CLOSED');
  }

  // Private methods

  private recordSuccess(duration: number): void {
    this.successes++;
    this.totalCalls++;
    this.lastSuccessTime = Date.now();
    this.recentCalls.push({ duration, success: true, timestamp: Date.now() });

    if (duration >= this.config.slowCallDuration) {
      this.slowCalls++;
    }

    switch (this.state) {
      case 'HALF_OPEN':
        if (this.getConsecutiveSuccesses() >= this.config.successThreshold) {
          this.transitionTo('CLOSED');
        }
        break;

      case 'CLOSED':
        // Check if slow call rate is too high
        this.checkSlowCallThreshold();
        break;
    }

    this.config.onSuccess();
  }

  private recordFailure(error: Error, duration: number): void {
    this.failures++;
    this.totalCalls++;
    this.lastFailureTime = Date.now();
    this.recentCalls.push({ duration, success: false, timestamp: Date.now() });

    switch (this.state) {
      case 'CLOSED':
        if (this.shouldTrip()) {
          this.transitionTo('OPEN');
        }
        break;

      case 'HALF_OPEN':
        this.transitionTo('OPEN');
        break;
    }

    this.config.onFailure(error);
  }

  private shouldTrip(): boolean {
    this.cleanupOldCalls();

    // Check volume threshold
    if (this.recentCalls.length < this.config.volumeThreshold) {
      return false;
    }

    // Check failure rate
    const failures = this.recentCalls.filter(c => !c.success).length;
    const failureRate = failures / this.recentCalls.length;

    return failureRate >= this.config.failureThreshold / 100;
  }

  private checkSlowCallThreshold(): void {
    this.cleanupOldCalls();

    if (this.recentCalls.length < this.config.volumeThreshold) {
      return;
    }

    const slowCalls = this.recentCalls.filter(
      c => c.duration >= this.config.slowCallDuration
    ).length;
    const slowCallRate = slowCalls / this.recentCalls.length;

    if (slowCallRate >= this.config.slowCallThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private getConsecutiveSuccesses(): number {
    let count = 0;
    for (let i = this.recentCalls.length - 1; i >= 0; i--) {
      const call = this.recentCalls[i];
      if (call && call.success) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.stateChangedAt = Date.now();

      if (newState === 'CLOSED') {
        this.failures = 0;
        this.slowCalls = 0;
      }

      this.config.onStateChange(oldState, newState);
    }
  }

  private cleanupOldCalls(): void {
    const cutoff = Date.now() - this.config.resetTimeout;
    this.recentCalls = this.recentCalls.filter(c => c.timestamp > cutoff);
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let isResolved = false;

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new TimeoutError(this.config.name, this.config.timeout));
        }
      }, this.config.timeout);

      fn()
        .then(result => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve(result);
          }
        })
        .catch(error => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(error);
          }
        });
    });
  }
}

export class CircuitOpenError extends Error {
  constructor(public circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(public circuitName: string, public timeout: number) {
    super(`Operation in circuit '${circuitName}' timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}
