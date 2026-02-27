/**
 * Sliding Window Algorithm Implementation
 * 
 * The sliding window algorithm tracks requests within a moving time window.
 * It provides smoother rate limiting compared to fixed window by considering
 * the exact timing of each request.
 */

import { 
  RateLimitAlgorithm, 
  AlgorithmInput, 
  AlgorithmOutput, 
  SlidingWindowState, 
  SlidingWindowConfig,
  AlgorithmOptions,
  MathUtils 
} from './types';
import { RateLimitConfig, RateLimitAction, Clock } from '../types';
import { AlgorithmError, ValidationError } from '../errors';

export class SlidingWindowAlgorithm implements RateLimitAlgorithm<SlidingWindowState> {
  readonly type = 'SLIDING_WINDOW';
  
  private readonly config: SlidingWindowConfig;
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
    
    this.mathUtils = new SlidingWindowMathUtils(this.clock);
    
    // Validate and extract configuration
    this.validateConfig(config);
    this.config = this.extractConfig(config);
    
    if (this.options.debug) {
      console.debug(`[SlidingWindow] Initialized with config:`, this.config);
    }
  }
  
  initializeState(input: AlgorithmInput): SlidingWindowState {
    return {
      key: input.key,
      configName: input.config.name,
      requests: [],
      lastUpdated: input.timestamp,
    };
  }
  
  check(input: AlgorithmInput): AlgorithmOutput {
    const startTime = this.clock.now();
    
    try {
      this.metrics.totalChecks++;
      
      // Get or initialize state
      const state = (input.currentState || this.initializeState(input)) as SlidingWindowState;
      
      // Calculate window boundaries
      const windowEnd = input.timestamp;
      const windowStart = new Date(windowEnd.getTime() - this.config.windowSizeMs);
      
      // Prune old requests outside the window
      const prunedRequests = this.mathUtils.pruneSlidingWindow(state.requests, windowStart);
      
      // Calculate current count in the window
      const currentCount = this.mathUtils.calculateSlidingWindowCount(
        prunedRequests,
        windowStart,
        windowEnd
      );
      
      // Check if request can be allowed
      const canAllow = currentCount + input.weight <= this.config.maxRequests;
      
      // Add the current request if allowed
      const updatedRequests = canAllow 
        ? [...prunedRequests, { timestamp: input.timestamp, weight: input.weight }]
        : prunedRequests;
      
      // Determine action
      let action: RateLimitAction;
      let retryAfter: number | undefined;
      
      if (canAllow) {
        action = RateLimitAction.ALLOW;
        this.metrics.allowedRequests++;
      } else {
        action = RateLimitAction.DENY;
        this.metrics.deniedRequests++;
        
        // Calculate retry after based on oldest request in window
        if (updatedRequests.length > 0) {
          const oldestRequest = updatedRequests[0];
          retryAfter = Math.max(0, oldestRequest.timestamp.getTime() - windowStart.getTime());
        } else {
          retryAfter = this.config.windowSizeMs;
        }
      }
      
      // Create new state
      const newState: SlidingWindowState = {
        ...state,
        requests: updatedRequests,
        lastUpdated: input.timestamp,
      };
      
      // Calculate reset time (when oldest request falls out of window)
      let resetAt = windowEnd;
      if (updatedRequests.length > 0) {
        const oldestRequest = updatedRequests[0];
        resetAt = new Date(oldestRequest.timestamp.getTime() + this.config.windowSizeMs);
      }
      
      const output: AlgorithmOutput = {
        allowed: canAllow,
        action,
        newState,
        remaining: Math.max(0, this.config.maxRequests - (currentCount + (canAllow ? input.weight : 0))),
        limit: this.config.maxRequests,
        resetAt,
        retryAfter,
        metadata: {
          windowSizeMs: this.config.windowSizeMs,
          maxRequests: this.config.maxRequests,
          currentCount,
          requestCount: updatedRequests.length,
          prunedCount: state.requests.length - prunedRequests.length,
          oldestRequest: state.requests[0]?.timestamp,
          newestRequest: state.requests[state.requests.length - 1]?.timestamp,
        },
      };
      
      if (this.options.debug) {
        console.debug(`[SlidingWindow] Check result:`, {
          key: input.key,
          allowed: canAllow,
          currentCount,
          windowStart,
          windowEnd,
          requestCount: updatedRequests.length,
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
  
  resetState(key: string, config: RateLimitConfig): SlidingWindowState {
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
  
  private extractConfig(config: RateLimitConfig): SlidingWindowConfig {
    return {
      windowSizeMs: config.windowMs,
      maxRequests: config.limit,
    };
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
 * Math utilities specific to Sliding Window algorithm
 */
class SlidingWindowMathUtils implements MathUtils {
  constructor(private readonly clock: Clock) {}
  
  calculateRefill(
    lastRefill: Date,
    currentTime: Date,
    refillRate: number,
    refillIntervalMs: number,
    maxTokens: number
  ): number {
    // Not used in sliding window
    return 0;
  }
  
  calculateLeak(
    lastLeak: Date,
    currentTime: Date,
    leakRate: number,
    leakIntervalMs: number,
    currentVolume: number
  ): number {
    // Not used in sliding window
    return 0;
  }
  
  calculateSlidingWindowCount(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date,
    windowEnd: Date
  ): number {
    let count = 0;
    
    for (const request of requests) {
      if (request.timestamp >= windowStart && request.timestamp <= windowEnd) {
        count += request.weight;
      }
    }
    
    return count;
  }
  
  pruneSlidingWindow(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date
  ): Array<{ timestamp: Date; weight: number }> {
    // Filter out requests outside the window
    return requests.filter(request => request.timestamp >= windowStart);
  }
}

/**
 * Factory function for creating Sliding Window algorithm instances
 */
export function createSlidingWindowAlgorithm(
  config: RateLimitConfig,
  clock: Clock,
  options?: AlgorithmOptions
): SlidingWindowAlgorithm {
  return new SlidingWindowAlgorithm(config, clock, options);
}
