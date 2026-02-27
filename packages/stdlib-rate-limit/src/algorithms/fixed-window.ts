/**
 * Fixed Window Algorithm Implementation
 * 
 * The fixed window algorithm divides time into discrete windows of equal size.
 * It tracks the number of requests within each window and resets the count
 * at the beginning of each new window. This is simpler than sliding window
 * but can allow bursts at window boundaries.
 */

import { 
  RateLimitAlgorithm, 
  AlgorithmInput, 
  AlgorithmOutput, 
  FixedWindowState, 
  FixedWindowConfig,
  AlgorithmOptions,
  MathUtils 
} from './types';
import { RateLimitConfig, RateLimitAction, Clock } from '../types';
import { AlgorithmError, ValidationError } from '../errors';

export class FixedWindowAlgorithm implements RateLimitAlgorithm<FixedWindowState> {
  readonly type = 'FIXED_WINDOW';
  
  private readonly config: FixedWindowConfig;
  private readonly clock: Clock;
  private readonly options: Required<AlgorithmOptions>;
  private readonly mathUtils: MathUtils;
  
  // Metrics
  private metrics = {
    totalChecks: 0,
    allowedRequests: 0,
    deniedRequests: 0,
    totalCheckTime: 0,
    lastCheckTime: new Date(),
  };
  
  constructor(config: RateLimitConfig, clock: Clock, options: AlgorithmOptions = {}) {
    this.clock = clock;
    this.options = {
      debug: false,
      enableMetrics: true,
      maxTrackedRequests: 1000,
      timePrecision: 1,
      clock,
      ...options,
    };
    
    this.mathUtils = new FixedWindowMathUtils(this.clock);
    
    // Validate and extract configuration
    this.validateConfig(config);
    this.config = this.extractConfig(config);
    
    if (this.options.debug) {
      console.debug(`[FixedWindow] Initialized with config:`, this.config);
    }
  }
  
  initializeState(input: AlgorithmInput): FixedWindowState {
    const windowStart = this.calculateWindowStart(input.timestamp);
    
    return {
      key: input.key,
      configName: input.config.name,
      count: 0,
      windowStart,
      lastUpdated: input.timestamp,
    };
  }
  
  check(input: AlgorithmInput): AlgorithmOutput {
    const startTime = this.clock.now();
    
    try {
      this.metrics.totalChecks++;
      
      // Get or initialize state
      const state = (input.currentState || this.initializeState(input)) as FixedWindowState;
      
      // Calculate current window start
      const currentWindowStart = this.calculateWindowStart(input.timestamp);
      
      // Check if we need to reset the window
      let count = state.count;
      let windowStart = state.windowStart;
      
      if (currentWindowStart > windowStart) {
        // New window, reset count
        count = 0;
        windowStart = currentWindowStart;
      }
      
      // Check if request can be allowed
      const canAllow = count + input.weight <= this.config.maxRequests;
      
      // Update count if allowed
      const newCount = canAllow ? count + input.weight : count;
      
      // Determine action
      let action: RateLimitAction;
      let retryAfter: number | undefined;
      
      if (canAllow) {
        action = RateLimitAction.ALLOW;
        this.metrics.allowedRequests++;
      } else {
        action = RateLimitAction.DENY;
        this.metrics.deniedRequests++;
        
        // Calculate retry after as time until next window
        const nextWindowStart = new Date(windowStart.getTime() + this.config.windowSizeMs);
        retryAfter = Math.max(0, nextWindowStart.getTime() - input.timestamp.getTime());
      }
      
      // Create new state
      const newState: FixedWindowState = {
        ...state,
        count: newCount,
        windowStart,
        lastUpdated: input.timestamp,
      };
      
      // Calculate reset time (start of next window)
      const resetAt = new Date(windowStart.getTime() + this.config.windowSizeMs);
      
      const output: AlgorithmOutput = {
        allowed: canAllow,
        action,
        newState,
        remaining: Math.max(0, this.config.maxRequests - newCount),
        limit: this.config.maxRequests,
        resetAt,
        retryAfter,
        metadata: {
          windowSizeMs: this.config.windowSizeMs,
          maxRequests: this.config.maxRequests,
          currentCount: count,
          windowStart,
          windowReset: resetAt,
          isNewWindow: currentWindowStart > state.windowStart,
        },
      };
      
      if (this.options.debug) {
        console.debug(`[FixedWindow] Check result:`, {
          key: input.key,
          allowed: canAllow,
          count: newCount,
          windowStart,
          resetAt,
          action,
        });
      }
      
      return output;
      
    } finally {
      // Update metrics
      const endTime = this.clock.now();
      const checkTime = endTime.getTime() - startTime.getTime();
      this.metrics.totalCheckTime += checkTime;
      this.metrics.lastCheckTime = endTime;
    }
  }
  
  resetState(key: string, config: RateLimitConfig): FixedWindowState {
    return this.initializeState({
      key,
      weight: 1,
      timestamp: this.clock.now(),
      config,
    });
  }
  
  getDefaultConfig(): Record<string, any> {
    return {
      windowSizeMs: 60000, // 1 minute
      maxRequests: 100,
    };
  }
  
  validateConfig(config: RateLimitConfig): void {
    if (!config.name) {
      throw new ValidationError('Config name is required');
    }
    
    if (config.limit <= 0) {
      throw new ValidationError('Limit must be positive', 'limit', config.limit);
    }
    
    if (config.windowMs <= 0) {
      throw new ValidationError('Window must be positive', 'windowMs', config.windowMs);
    }
  }
  
  private extractConfig(config: RateLimitConfig): FixedWindowConfig {
    return {
      windowSizeMs: config.windowMs,
      maxRequests: config.limit,
    };
  }
  
  /**
   * Calculate the start of the window for a given timestamp
   */
  private calculateWindowStart(timestamp: Date): Date {
    const epoch = timestamp.getTime();
    const windowNumber = Math.floor(epoch / this.config.windowSizeMs);
    return new Date(windowNumber * this.config.windowSizeMs);
  }
  
  // Public methods for metrics and debugging
  getMetrics() {
    return {
      ...this.metrics,
      averageCheckTime: this.metrics.totalChecks > 0 
        ? this.metrics.totalCheckTime / this.metrics.totalChecks 
        : 0,
    };
  }
  
  resetMetrics(): void {
    this.metrics = {
      totalChecks: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      totalCheckTime: 0,
      lastCheckTime: new Date(),
    };
  }
}

/**
 * Math utilities specific to Fixed Window algorithm
 */
class FixedWindowMathUtils implements MathUtils {
  constructor(private readonly clock: Clock) {}
  
  calculateRefill(
    lastRefill: Date,
    currentTime: Date,
    refillRate: number,
    refillIntervalMs: number,
    maxTokens: number
  ): number {
    // Not used in fixed window
    return 0;
  }
  
  calculateLeak(
    lastLeak: Date,
    currentTime: Date,
    leakRate: number,
    leakIntervalMs: number,
    currentVolume: number
  ): number {
    // Not used in fixed window
    return 0;
  }
  
  calculateSlidingWindowCount(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date,
    windowEnd: Date
  ): number {
    // Not used in fixed window
    return 0;
  }
  
  pruneSlidingWindow(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date
  ): Array<{ timestamp: Date; weight: number }> {
    // Not used in fixed window
    return requests;
  }
}

/**
 * Factory function for creating Fixed Window algorithm instances
 */
export function createFixedWindowAlgorithm(
  config: RateLimitConfig,
  clock: Clock,
  options?: AlgorithmOptions
): FixedWindowAlgorithm {
  return new FixedWindowAlgorithm(config, clock, options);
}
