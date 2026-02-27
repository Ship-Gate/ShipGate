/**
 * Circuit Breaker
 * 
 * Protect against cascading failures.
 */

export interface CircuitBreakerConfig {
  /** Failure threshold before opening */
  failureThreshold: number;
  /** Success threshold to close (in half-open state) */
  successThreshold: number;
  /** Time in half-open state before fully closing (ms) */
  halfOpenTimeout: number;
  /** Time circuit stays open before trying again (ms) */
  resetTimeout: number;
  /** Minimum requests before calculating failure rate */
  minimumRequests?: number;
  /** Failure rate threshold (0-1) */
  failureRateThreshold?: number;
}

export type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitStats {
  requests: number;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  lastStateChange: Date;
}

/**
 * Circuit Breaker
 */
export class CircuitBreaker {
  private name: string;
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private stats: CircuitStats;
  private stateChangedAt: number;
  private halfOpenSuccesses = 0;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 3,
      halfOpenTimeout: config?.halfOpenTimeout ?? 30000,
      resetTimeout: config?.resetTimeout ?? 60000,
      minimumRequests: config?.minimumRequests ?? 10,
      failureRateThreshold: config?.failureRateThreshold ?? 0.5,
    };
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      lastStateChange: new Date(),
    };
    this.stateChangedAt = Date.now();
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    this.checkStateTransition();

    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      return false;
    }

    // Half-open: allow limited requests
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    this.stats.requests++;
    this.stats.successes++;
    this.stats.lastSuccess = new Date();

    if (this.state === 'half_open') {
      this.halfOpenSuccesses++;

      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.stats.requests++;
    this.stats.failures++;
    this.stats.lastFailure = new Date();

    if (this.state === 'half_open') {
      // Any failure in half-open returns to open
      this.transitionTo('open');
      return;
    }

    // Check if we should open the circuit
    if (this.state === 'closed') {
      if (this.shouldTrip()) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Check if circuit should trip
   */
  private shouldTrip(): boolean {
    // Check absolute failure threshold
    if (this.stats.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate
    if (this.stats.requests >= this.config.minimumRequests) {
      const failureRate = this.stats.failures / this.stats.requests;
      if (failureRate >= this.config.failureRateThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check and perform state transitions
   */
  private checkStateTransition(): void {
    const now = Date.now();
    const elapsed = now - this.stateChangedAt;

    if (this.state === 'open' && elapsed >= this.config.resetTimeout) {
      this.transitionTo('half_open');
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.stateChangedAt = Date.now();
    this.stats.lastStateChange = new Date();

    // Reset counters on transition
    if (newState === 'closed') {
      this.stats.failures = 0;
      this.stats.successes = 0;
      this.stats.requests = 0;
    }

    if (newState === 'half_open') {
      this.halfOpenSuccesses = 0;
    }

    // Could emit event here for monitoring
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitStats & { state: CircuitState; name: string } {
    return {
      ...this.stats,
      state: this.getState(),
      name: this.name,
    };
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.stats.requests === 0) return 0;
    return this.stats.failures / this.stats.requests;
  }

  /**
   * Force circuit to specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.transitionTo('closed');
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isAllowed()) {
      throw new CircuitOpenError(this.name);
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
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit '${circuitName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Create a circuit breaker
 */
export function createCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return new CircuitBreaker(name, config);
}
