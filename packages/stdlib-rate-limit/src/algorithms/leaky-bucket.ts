/**
 * Leaky Bucket Algorithm Implementation
 * 
 * The leaky bucket algorithm processes requests at a fixed rate.
 * It uses a bucket that "leaks" requests at a constant rate, allowing
 * for smooth traffic shaping. Requests are added to the bucket and
 * processed as they leak out. If the bucket overflows, requests are denied.
 */

import { 
  RateLimitAlgorithm, 
  AlgorithmInput, 
  AlgorithmOutput, 
  LeakyBucketState, 
  LeakyBucketConfig,
  AlgorithmOptions,
  MathUtils 
} from './types';
import { RateLimitConfig, RateLimitAction, Clock } from '../types';
import { AlgorithmError, ValidationError } from '../errors';

export class LeakyBucketAlgorithm implements RateLimitAlgorithm<LeakyBucketState> {
  readonly type = 'LEAKY_BUCKET';
  
  private readonly config: LeakyBucketConfig;
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
    
    this.mathUtils = new LeakyBucketMathUtils(this.clock);
    
    // Validate and extract configuration
    this.validateConfig(config);
    this.config = this.extractConfig(config);
    
    if (this.options.debug) {
      console.debug(`[LeakyBucket] Initialized with config:`, this.config);
    }
  }
  
  initializeState(input: AlgorithmInput): LeakyBucketState {
    return {
      key: input.key,
      configName: input.config.name,
      currentVolume: 0,
      lastLeak: input.timestamp,
      lastUpdated: input.timestamp,
    };
  }
  
  check(input: AlgorithmInput): AlgorithmOutput {
    const startTime = this.clock.now();
    
    try {
      this.metrics.totalChecks++;
      
      // Get or initialize state
      const state = (input.currentState || this.initializeState(input)) as LeakyBucketState;
      
      // Calculate leak amount based on elapsed time
      const leakAmount = this.mathUtils.calculateLeak(
        state.lastLeak,
        input.timestamp,
        this.config.leakRate,
        this.config.leakIntervalMs,
        state.currentVolume
      );
      
      // Update volume after leak
      const leakedVolume = Math.max(0, state.currentVolume - leakAmount);
      
      // Check if adding the request would overflow the bucket
      const canAllow = leakedVolume + input.weight <= this.config.capacity;
      
      // Calculate new volume
      const newVolume = canAllow 
        ? leakedVolume + input.weight 
        : leakedVolume;
      
      // Determine action
      let action: RateLimitAction;
      let retryAfter: number | undefined;
      
      if (canAllow) {
        action = RateLimitAction.ALLOW;
        this.metrics.allowedRequests++;
      } else {
        action = RateLimitAction.DENY;
        this.metrics.deniedRequests++;
        
        // Calculate retry after based on leak rate
        if (this.config.leakRate > 0) {
          const overflow = leakedVolume + input.weight - this.config.capacity;
          retryAfter = Math.ceil(
            overflow * (this.config.leakIntervalMs / this.config.leakRate)
          );
        } else {
          // Bucket never leaks, can't accept more requests
          retryAfter = -1; // Indicates never
        }
      }
      
      // Create new state
      const newState: LeakyBucketState = {
        ...state,
        currentVolume: newVolume,
        lastLeak: input.timestamp,
        lastUpdated: input.timestamp,
      };
      
      // Calculate reset time (when bucket will be empty)
      let resetAt = input.timestamp;
      if (newVolume > 0 && this.config.leakRate > 0) {
        resetAt = new Date(
          input.timestamp.getTime() + 
          Math.ceil(newVolume * (this.config.leakIntervalMs / this.config.leakRate))
        );
      }
      
      const output: AlgorithmOutput = {
        allowed: canAllow,
        action,
        newState,
        remaining: Math.max(0, this.config.capacity - newVolume),
        limit: this.config.capacity,
        resetAt,
        retryAfter,
        metadata: {
          capacity: this.config.capacity,
          leakRate: this.config.leakRate,
          currentVolume: newVolume,
          leakAmount,
          overflow: canAllow ? 0 : leakedVolume + input.weight - this.config.capacity,
        },
      };
      
      if (this.options.debug) {
        console.debug(`[LeakyBucket] Check result:`, {
          key: input.key,
          allowed: canAllow,
          currentVolume: newVolume,
          leakAmount,
          weight: input.weight,
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
  
  resetState(key: string, config: RateLimitConfig): LeakyBucketState {
    return this.initializeState({
      key,
      weight: 1,
      timestamp: this.clock.now(),
      config,
    });
  }
  
  getDefaultConfig(): Record<string, any> {
    return {
      capacity: 10,
      leakRate: 1,
      leakIntervalMs: 1000,
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
    
    // Validate burst configuration (used as capacity)
    if (config.burstLimit !== undefined && config.burstLimit <= 0) {
      throw new ValidationError('Burst limit must be positive', 'burstLimit', config.burstLimit);
    }
  }
  
  private extractConfig(config: RateLimitConfig): LeakyBucketConfig {
    // Use burst limit as capacity if specified, otherwise use limit
    const capacity = config.burstLimit || config.limit;
    
    // Calculate leak rate based on limit and window
    const leakRate = config.limit;
    const leakIntervalMs = config.windowMs;
    
    return {
      capacity,
      leakRate,
      leakIntervalMs,
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
 * Math utilities specific to Leaky Bucket algorithm
 */
class LeakyBucketMathUtils implements MathUtils {
  constructor(private readonly clock: Clock) {}
  
  calculateRefill(
    lastRefill: Date,
    currentTime: Date,
    refillRate: number,
    refillIntervalMs: number,
    maxTokens: number
  ): number {
    // Not used in leaky bucket
    return 0;
  }
  
  calculateLeak(
    lastLeak: Date,
    currentTime: Date,
    leakRate: number,
    leakIntervalMs: number,
    currentVolume: number
  ): number {
    if (leakRate === 0 || leakIntervalMs === 0) {
      return 0;
    }
    
    const elapsedMs = currentTime.getTime() - lastLeak.getTime();
    
    if (elapsedMs <= 0) {
      return 0;
    }
    
    // Calculate how many leak intervals have passed
    const intervals = elapsedMs / leakIntervalMs;
    
    // Calculate amount to leak (floor to prevent fractional leaks)
    const leakAmount = Math.floor(intervals * leakRate);
    
    // Ensure we don't leak more than current volume
    return Math.min(leakAmount, currentVolume);
  }
  
  calculateSlidingWindowCount(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date,
    windowEnd: Date
  ): number {
    // Not used in leaky bucket
    return 0;
  }
  
  pruneSlidingWindow(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date
  ): Array<{ timestamp: Date; weight: number }> {
    // Not used in leaky bucket
    return requests;
  }
}

/**
 * Factory function for creating Leaky Bucket algorithm instances
 */
export function createLeakyBucketAlgorithm(
  config: RateLimitConfig,
  clock: Clock,
  options?: AlgorithmOptions
): LeakyBucketAlgorithm {
  return new LeakyBucketAlgorithm(config, clock, options);
}
