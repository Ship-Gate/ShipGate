/**
 * Token Bucket Algorithm Implementation
 * 
 * The token bucket algorithm allows for bursts of traffic while controlling
 * the average rate. It uses a bucket that fills with tokens at a fixed rate.
 * Each request consumes one or more tokens. If the bucket is empty, requests
 * are denied until tokens are added.
 */

import { 
  RateLimitAlgorithm, 
  AlgorithmInput, 
  AlgorithmOutput, 
  TokenBucketState, 
  TokenBucketConfig,
  AlgorithmOptions,
  MathUtils 
} from './types';
import { RateLimitConfig, RateLimitAction, Clock } from '../types';
import { AlgorithmError, ValidationError } from '../errors';

export class TokenBucketAlgorithm implements RateLimitAlgorithm<TokenBucketState> {
  readonly type = 'TOKEN_BUCKET';
  
  private readonly config: TokenBucketConfig;
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
    
    this.mathUtils = new TokenBucketMathUtils(this.clock);
    
    // Validate and extract configuration
    this.validateConfig(config);
    this.config = this.extractConfig(config);
    
    if (this.options.debug) {
      console.debug(`[TokenBucket] Initialized with config:`, this.config);
    }
  }
  
  initializeState(input: AlgorithmInput): TokenBucketState {
    return {
      key: input.key,
      configName: input.config.name,
      tokens: this.config.bucketSize,
      lastRefill: input.timestamp,
      lastUpdated: input.timestamp,
    };
  }
  
  check(input: AlgorithmInput): AlgorithmOutput {
    const startTime = this.clock.now();
    
    try {
      this.metrics.totalChecks++;
      
      // Get or initialize state
      const state = (input.currentState || this.initializeState(input)) as TokenBucketState;
      
      // Refill tokens based on elapsed time
      const tokensToAdd = this.mathUtils.calculateRefill(
        state.lastRefill,
        input.timestamp,
        this.config.refillRate,
        this.config.refillIntervalMs,
        this.config.bucketSize
      );
      
      // Update token count
      const newTokens = Math.min(
        this.config.bucketSize,
        state.tokens + tokensToAdd
      );
      
      // Check if request can be allowed
      const canAllow = newTokens >= input.weight;
      const finalTokens = canAllow ? newTokens - input.weight : newTokens;
      
      // Determine action
      let action: RateLimitAction;
      let retryAfter: number | undefined;
      
      if (canAllow) {
        action = RateLimitAction.ALLOW;
        this.metrics.allowedRequests++;
      } else {
        action = RateLimitAction.DENY;
        this.metrics.deniedRequests++;
        
        // Calculate retry after based on refill rate
        retryAfter = Math.ceil(
          (input.weight - finalTokens) * 
          (this.config.refillIntervalMs / this.config.refillRate)
        );
      }
      
      // Create new state
      const newState: TokenBucketState = {
        ...state,
        tokens: finalTokens,
        lastRefill: input.timestamp,
        lastUpdated: input.timestamp,
      };
      
      // Calculate reset time (when bucket will be full)
      const resetAt = new Date(
        input.timestamp.getTime() + 
        Math.ceil((this.config.bucketSize - finalTokens) * 
        (this.config.refillIntervalMs / this.config.refillRate))
      );
      
      const output: AlgorithmOutput = {
        allowed: canAllow,
        action,
        newState,
        remaining: Math.floor(finalTokens),
        limit: this.config.bucketSize,
        resetAt,
        retryAfter,
        metadata: {
          bucketSize: this.config.bucketSize,
          refillRate: this.config.refillRate,
          tokensToAdd: tokensToAdd,
          tokensConsumed: canAllow ? input.weight : 0,
        },
      };
      
      if (this.options.debug) {
        console.debug(`[TokenBucket] Check result:`, {
          key: input.key,
          allowed: canAllow,
          tokens: finalTokens,
          tokensToAdd,
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
  
  resetState(key: string, config: RateLimitConfig): TokenBucketState {
    return this.initializeState({
      key,
      weight: 1,
      timestamp: this.clock.now(),
      config,
    });
  }
  
  getDefaultConfig(): Record<string, any> {
    return {
      bucketSize: 10,
      refillRate: 1,
      refillIntervalMs: 1000,
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
    
    // Validate burst configuration
    if (config.burstLimit !== undefined && config.burstLimit <= 0) {
      throw new ValidationError('Burst limit must be positive', 'burstLimit', config.burstLimit);
    }
    
    if (config.burstWindowMs !== undefined && config.burstWindowMs <= 0) {
      throw new ValidationError('Burst window must be positive', 'burstWindowMs', config.burstWindowMs);
    }
  }
  
  private extractConfig(config: RateLimitConfig): TokenBucketConfig {
    // Use burst limit as bucket size if specified, otherwise use limit
    const bucketSize = config.burstLimit || config.limit;
    
    // Calculate refill rate based on limit and window
    const refillRate = config.limit;
    const refillIntervalMs = config.windowMs;
    
    return {
      bucketSize,
      refillRate,
      refillIntervalMs,
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
 * Math utilities specific to Token Bucket algorithm
 */
class TokenBucketMathUtils implements MathUtils {
  constructor(private readonly clock: Clock) {}
  
  calculateRefill(
    lastRefill: Date,
    currentTime: Date,
    refillRate: number,
    refillIntervalMs: number,
    maxTokens: number
  ): number {
    if (refillRate === 0 || refillIntervalMs === 0) {
      return 0;
    }
    
    const elapsedMs = currentTime.getTime() - lastRefill.getTime();
    
    if (elapsedMs <= 0) {
      return 0;
    }
    
    // Calculate how many refill intervals have passed
    const intervals = elapsedMs / refillIntervalMs;
    
    // Calculate tokens to add (floor to prevent fractional tokens)
    const tokensToAdd = Math.floor(intervals * refillRate);
    
    // Ensure we don't exceed max tokens
    return Math.min(tokensToAdd, maxTokens);
  }
  
  calculateLeak(
    lastLeak: Date,
    currentTime: Date,
    leakRate: number,
    leakIntervalMs: number,
    currentVolume: number
  ): number {
    // Not used in token bucket
    return 0;
  }
  
  calculateSlidingWindowCount(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date,
    windowEnd: Date
  ): number {
    // Not used in token bucket
    return 0;
  }
  
  pruneSlidingWindow(
    requests: Array<{ timestamp: Date; weight: number }>,
    windowStart: Date
  ): Array<{ timestamp: Date; weight: number }> {
    // Not used in token bucket
    return requests;
  }
}

/**
 * Factory function for creating Token Bucket algorithm instances
 */
export function createTokenBucketAlgorithm(
  config: RateLimitConfig,
  clock: Clock,
  options?: AlgorithmOptions
): TokenBucketAlgorithm {
  return new TokenBucketAlgorithm(config, clock, options);
}
