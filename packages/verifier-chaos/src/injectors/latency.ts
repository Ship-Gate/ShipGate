/**
 * Latency Injector
 * 
 * Adds artificial latency to operations for chaos testing.
 */

import type { Timeline } from '../timeline.js';

export type LatencyDistribution = 'fixed' | 'uniform' | 'normal' | 'exponential';

export interface LatencyInjectorConfig {
  /** Base latency in milliseconds */
  latencyMs: number;
  /** Maximum latency for distributions (ms) */
  maxLatencyMs?: number;
  /** Distribution type */
  distribution?: LatencyDistribution;
  /** Standard deviation for normal distribution */
  stdDev?: number;
  /** Probability of adding latency (0-1) */
  probability?: number;
  /** Operations to affect */
  affectedOperations?: string[];
}

export interface LatencyInjectorState {
  active: boolean;
  operationsDelayed: number;
  totalLatencyAdded: number;
  averageLatency: number;
  maxLatencyObserved: number;
}

/**
 * Latency injector for chaos testing
 */
export class LatencyInjector {
  private config: Required<LatencyInjectorConfig>;
  private state: LatencyInjectorState;
  private timeline: Timeline | null = null;
  private latencyHistory: number[] = [];

  constructor(config: LatencyInjectorConfig) {
    this.config = {
      latencyMs: config.latencyMs,
      maxLatencyMs: config.maxLatencyMs ?? config.latencyMs * 2,
      distribution: config.distribution ?? 'fixed',
      stdDev: config.stdDev ?? config.latencyMs * 0.2,
      probability: config.probability ?? 1.0,
      affectedOperations: config.affectedOperations ?? [],
    };
    this.state = {
      active: false,
      operationsDelayed: 0,
      totalLatencyAdded: 0,
      averageLatency: 0,
      maxLatencyObserved: 0,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Activate the latency injector
   */
  activate(): void {
    if (this.state.active) return;

    this.latencyHistory = [];
    this.state = {
      active: true,
      operationsDelayed: 0,
      totalLatencyAdded: 0,
      averageLatency: 0,
      maxLatencyObserved: 0,
    };

    this.timeline?.record('injection_start', {
      injector: 'latency',
      config: this.config,
    });
  }

  /**
   * Deactivate the latency injector
   */
  deactivate(): void {
    if (!this.state.active) return;

    this.state.active = false;
    this.timeline?.record('injection_end', {
      injector: 'latency',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): LatencyInjectorState {
    return { ...this.state };
  }

  /**
   * Calculate latency based on distribution
   */
  private calculateLatency(): number {
    switch (this.config.distribution) {
      case 'fixed':
        return this.config.latencyMs;
      
      case 'uniform':
        return this.config.latencyMs + 
          Math.random() * (this.config.maxLatencyMs - this.config.latencyMs);
      
      case 'normal':
        return this.normalDistribution(this.config.latencyMs, this.config.stdDev);
      
      case 'exponential':
        return this.exponentialDistribution(this.config.latencyMs);
      
      default:
        return this.config.latencyMs;
    }
  }

  /**
   * Generate normally distributed value using Box-Muller transform
   */
  private normalDistribution(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = mean + z * stdDev;
    // Clamp to positive values up to max
    return Math.max(0, Math.min(value, this.config.maxLatencyMs));
  }

  /**
   * Generate exponentially distributed value
   */
  private exponentialDistribution(mean: number): number {
    const value = -mean * Math.log(Math.random());
    return Math.min(value, this.config.maxLatencyMs);
  }

  /**
   * Check if operation should be delayed
   */
  private shouldDelay(operationName?: string): boolean {
    // Check probability
    if (Math.random() > this.config.probability) return false;

    // Check if specific operations are targeted
    if (this.config.affectedOperations.length > 0 && operationName) {
      return this.config.affectedOperations.includes(operationName);
    }

    return true;
  }

  /**
   * Update statistics
   */
  private updateStats(latency: number): void {
    this.state.operationsDelayed++;
    this.state.totalLatencyAdded += latency;
    this.latencyHistory.push(latency);
    this.state.averageLatency = this.state.totalLatencyAdded / this.state.operationsDelayed;
    this.state.maxLatencyObserved = Math.max(this.state.maxLatencyObserved, latency);
  }

  /**
   * Inject latency - wraps an async operation
   */
  async inject<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    if (!this.state.active || !this.shouldDelay(operationName)) {
      return operation();
    }

    const latency = this.calculateLatency();
    this.updateStats(latency);

    this.timeline?.record('injection_start', {
      injector: 'latency',
      operationName,
      latencyMs: latency,
    });

    await this.delay(latency);

    this.timeline?.record('injection_end', {
      injector: 'latency',
      operationName,
      latencyMs: latency,
    });

    return operation();
  }

  /**
   * Simply delay for configured amount
   */
  async delay(ms?: number): Promise<void> {
    const latency = ms ?? (this.state.active ? this.calculateLatency() : 0);
    if (latency > 0) {
      if (!ms) this.updateStats(latency);
      await new Promise(resolve => setTimeout(resolve, latency));
    }
  }

  /**
   * Create a delayed version of a function
   */
  wrap<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    operationName?: string
  ): (...args: TArgs) => Promise<TResult> {
    const self = this;
    return async function wrapped(...args: TArgs): Promise<TResult> {
      return self.inject(() => fn(...args), operationName);
    };
  }

  /**
   * Get latency percentile
   */
  getPercentile(p: number): number {
    if (this.latencyHistory.length === 0) return 0;
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }
}

/**
 * Create a fixed latency injector
 */
export function createFixedLatency(latencyMs: number): LatencyInjector {
  return new LatencyInjector({
    latencyMs,
    distribution: 'fixed',
  });
}

/**
 * Create a variable latency injector with uniform distribution
 */
export function createVariableLatency(minMs: number, maxMs: number): LatencyInjector {
  return new LatencyInjector({
    latencyMs: minMs,
    maxLatencyMs: maxMs,
    distribution: 'uniform',
  });
}

/**
 * Create a jittery latency injector with normal distribution
 */
export function createJitteryLatency(meanMs: number, stdDevMs?: number): LatencyInjector {
  return new LatencyInjector({
    latencyMs: meanMs,
    distribution: 'normal',
    stdDev: stdDevMs,
  });
}

/**
 * Create a spike latency injector with exponential distribution
 */
export function createSpikeLatency(baseMs: number, maxMs: number): LatencyInjector {
  return new LatencyInjector({
    latencyMs: baseMs,
    maxLatencyMs: maxMs,
    distribution: 'exponential',
  });
}
