/**
 * @packageDocumentation
 * @isl-lang/stdlib-rate-limit
 * 
 * A comprehensive rate limiting library for ISL applications
 * 
 * Features:
 * - Multiple rate limiting algorithms (Token Bucket, Sliding Window, Fixed Window, Leaky Bucket)
 * - Pluggable storage backends (Memory, Redis)
 * - Framework-agnostic middleware
 * - Policy-based rate limiting with tiered support
 * - Comprehensive error handling and metrics
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export * from './types';
export * from './errors';

// ============================================================================
// ALGORITHMS
// ============================================================================

export * from './algorithms/types';
export { TokenBucketAlgorithm, createTokenBucketAlgorithm } from './algorithms/token-bucket';
export { SlidingWindowAlgorithm, createSlidingWindowAlgorithm } from './algorithms/sliding-window';
export { FixedWindowAlgorithm, createFixedWindowAlgorithm } from './algorithms/fixed-window';
export { LeakyBucketAlgorithm, createLeakyBucketAlgorithm } from './algorithms/leaky-bucket';

// ============================================================================
// STORAGE
// ============================================================================

export * from './store/types';
export * from './store/store';
export * from './store/memory';

// ============================================================================
// MIDDLEWARE
// ============================================================================

export * from './middleware/types';
export * from './middleware/key-extractor';
export * from './middleware/http';

// ============================================================================
// POLICIES
// ============================================================================

export * from './policies/types';
export * from './policies/policy';
export * from './policies/tiered';

// ============================================================================
// MAIN RATE LIMITER CLASS
// ============================================================================

import { 
  RateLimitStorage, 
  RateLimitConfig, 
  CheckInput, 
  CheckResult, 
  RateLimitKey, 
  IdentifierType,
  BucketId,
  Clock,
  RateLimiterOptions
} from './types';
import { createMemoryStore } from './store/memory';
import { createTokenBucketAlgorithm } from './algorithms/token-bucket';
import { createSlidingWindowAlgorithm } from './algorithms/sliding-window';
import { createFixedWindowAlgorithm } from './algorithms/fixed-window';
import { createLeakyBucketAlgorithm } from './algorithms/leaky-bucket';
import { RateLimitAlgorithm, AlgorithmInput, AlgorithmOutput } from './algorithms/types';
import { 
  RateLimitError, 
  MissingConfigError, 
  StorageError,
  ErrorFactory 
} from './errors';

/**
 * Default clock implementation
 */
class DefaultClock implements Clock {
  now(): Date {
    return new Date();
  }
  
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main Rate Limiter class
 */
export class RateLimiter {
  private storage: RateLimitStorage;
  private configs: Map<string, RateLimitConfig> = new Map();
  private algorithms: Map<string, RateLimitAlgorithm> = new Map();
  private clock: Clock;
  private options: RateLimiterOptions;
  private defaultConfig?: string;
  
  constructor(options: RateLimiterOptions) {
    this.storage = options.storage;
    this.clock = options.clock || new DefaultClock();
    this.options = {
      defaultConfig: undefined,
      keyGenerator: this.defaultKeyGenerator,
      includeHeaders: true,
      headerPrefix: 'X-RateLimit',
      enableEscalation: false,
      maxEscalationLevel: 3,
      ...options,
    };
    
    // Register configurations
    for (const config of options.configs) {
      this.addConfig(config);
    }
    
    this.defaultConfig = this.options.defaultConfig || options.configs[0]?.name;
    
    // Initialize storage if needed
    if ('initialize' in this.storage) {
      (this.storage as any).initialize?.();
    }
  }
  
  /**
   * Check if a request should be allowed
   */
  async check(input: CheckInput): Promise<CheckResult> {
    try {
      // Get configuration
      const config = this.getConfig(input.configName || this.defaultConfig!);
      
      // Generate bucket key
      const bucketId = this.options.keyGenerator!(input);
      
      // Get current bucket state
      const bucket = await this.storage.getBucket(bucketId);
      
      // Get algorithm
      const algorithm = this.getAlgorithm(config);
      
      // Create algorithm input
      const algorithmInput: AlgorithmInput = {
        key: input.key,
        weight: input.weight || 1,
        timestamp: this.clock.now(),
        config,
        currentState: bucket ? {
          key: bucket.key,
          configName: bucket.configName,
          // Token bucket fields
          tokens: bucket.limit - bucket.currentCount,
          lastRefill: bucket.windowStart,
          // Sliding/Fixed window fields
          requests: [],
          count: bucket.currentCount,
          windowStart: bucket.windowStart,
          // Leaky bucket fields
          currentVolume: bucket.currentCount,
          lastLeak: bucket.windowStart,
          // Common fields
          currentCount: bucket.currentCount,
          totalRequests: bucket.totalRequests,
          windowSizeMs: bucket.windowSizeMs,
          limit: bucket.limit,
          lastUpdated: bucket.updatedAt,
          violationCount: bucket.violationCount,
        } : undefined,
      };
      
      // Check rate limit
      const output = algorithm.check(algorithmInput);
      
      // Update storage - map algorithm-specific state to bucket fields
      const now = this.clock.now();
      await this.storage.setBucket({
        id: bucketId,
        key: input.key,
        identifierType: input.identifierType,
        configName: config.name,
        currentCount: output.limit - output.remaining,
        totalRequests: (bucket?.totalRequests || 0) + (input.weight || 1),
        windowStart: output.newState.lastUpdated || now,
        windowSizeMs: config.windowMs,
        limit: config.limit,
        blockedUntil: output.newState.blockedUntil,
        violationCount: output.newState.violationCount || 0,
        lastViolation: undefined,
        createdAt: bucket?.createdAt || now,
        updatedAt: now,
      });
      
      // Create result
      const result: CheckResult = {
        action: output.action,
        allowed: output.allowed,
        remaining: output.remaining,
        limit: output.limit,
        resetAt: output.resetAt,
        retryAfterMs: output.retryAfter,
        headers: this.options.includeHeaders ? this.generateHeaders(output, config) : undefined,
        bucketKey: bucketId,
        configName: config.name,
        violationCount: output.newState.violationCount,
      };
      
      // Handle events
      if (!output.allowed) {
        await this.handleViolation(input, result);
      }
      
      return result;
      
    } catch (error) {
      this.options.onError?.(error as Error, 'check');
      
      if (error instanceof RateLimitError) {
        throw error;
      }
      
      throw new RateLimitError(
        `Rate limit check failed: ${(error as Error).message}`,
        { input, error }
      );
    }
  }
  
  /**
   * Add a new configuration
   */
  addConfig(config: RateLimitConfig): void {
    this.configs.set(config.name, config);
    
    // Create algorithm for this config
    const algorithm = this.createAlgorithm(config);
    this.algorithms.set(config.name, algorithm);
  }
  
  /**
   * Remove a configuration
   */
  removeConfig(name: string): boolean {
    const removed = this.configs.delete(name);
    if (removed) {
      this.algorithms.delete(name);
    }
    return removed;
  }
  
  /**
   * Get a configuration by name
   */
  getConfig(name: string): RateLimitConfig {
    const config = this.configs.get(name);
    if (!config) {
      throw new MissingConfigError(name);
    }
    return config;
  }
  
  /**
   * Get all configurations
   */
  getConfigs(): RateLimitConfig[] {
    return Array.from(this.configs.values());
  }
  
  /**
   * Reset a rate limit bucket
   */
  async resetBucket(key: RateLimitKey, configName?: string, identifierType?: IdentifierType): Promise<void> {
    const config = this.getConfig(configName || this.defaultConfig!);
    
    if (identifierType) {
      const bucketId = this.options.keyGenerator!({ key, identifierType, configName: config.name });
      await this.storage.deleteBucket(bucketId);
    } else {
      // Try all identifier types to ensure the bucket is found
      for (const idType of Object.values(IdentifierType)) {
        const bucketId = this.options.keyGenerator!({ key, identifierType: idType, configName: config.name });
        const bucket = await this.storage.getBucket(bucketId);
        if (bucket) {
          await this.storage.deleteBucket(bucketId);
        }
      }
    }
  }
  
  /**
   * Get storage metrics
   */
  async getStorageMetrics(): Promise<any> {
    if ('getMetrics' in this.storage) {
      return (this.storage as any).getMetrics();
    }
    return null;
  }
  
  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.storage.healthCheck();
    } catch {
      return false;
    }
  }
  
  /**
   * Close the rate limiter and cleanup resources
   */
  async close(): Promise<void> {
    if ('close' in this.storage) {
      await (this.storage as any).close();
    }
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private defaultKeyGenerator(input: CheckInput): BucketId {
    return `${input.configName || 'default'}:${input.identifierType}:${input.key}`;
  }
  
  private getAlgorithm(config: RateLimitConfig): RateLimitAlgorithm {
    const algorithm = this.algorithms.get(config.name);
    if (!algorithm) {
      throw new Error(`No algorithm found for config: ${config.name}`);
    }
    return algorithm;
  }
  
  private createAlgorithm(config: RateLimitConfig): RateLimitAlgorithm {
    const algorithmType = config.algorithm || 'TOKEN_BUCKET';
    
    switch (algorithmType) {
      case 'TOKEN_BUCKET':
        return createTokenBucketAlgorithm(config, this.clock);
      case 'SLIDING_WINDOW':
        return createSlidingWindowAlgorithm(config, this.clock);
      case 'FIXED_WINDOW':
        return createFixedWindowAlgorithm(config, this.clock);
      case 'LEAKY_BUCKET':
        return createLeakyBucketAlgorithm(config, this.clock);
      default:
        throw new Error(`Unsupported algorithm: ${algorithmType}`);
    }
  }
  
  private generateHeaders(output: AlgorithmOutput, config: RateLimitConfig): Record<string, string> {
    const prefix = this.options.headerPrefix || 'X-RateLimit';
    const limit = output.limit ?? config.limit;
    
    return {
      [`${prefix}-Limit`]: limit.toString(),
      [`${prefix}-Remaining`]: output.remaining.toString(),
      [`${prefix}-Reset`]: Math.ceil(output.resetAt.getTime() / 1000).toString(),
      [`${prefix}-Policy`]: config.name,
      ...(output.retryAfter && { [`${prefix}-Retry-After`]: Math.ceil(output.retryAfter / 1000).toString() }),
    };
  }
  
  private async handleViolation(input: CheckInput, result: CheckResult): Promise<void> {
    // Record violation if needed
    if (this.options.enableEscalation) {
      // TODO: Implement escalation logic
    }
    
    // Call violation handler
    if (this.options.onViolation) {
      await this.options.onViolation({
        id: `${input.key}-${Date.now()}`,
        key: input.key,
        identifierType: input.identifierType,
        configName: result.configName,
        timestamp: this.clock.now(),
        requestCount: 1,
        limit: result.limit,
        actionTaken: result.action,
        metadata: input.metadata,
      });
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a rate limiter with memory storage
 */
export function createRateLimiter(configs: RateLimitConfig[], options?: Partial<RateLimiterOptions>): RateLimiter {
  const memoryStore = createMemoryStore();
  
  return new RateLimiter({
    storage: memoryStore,
    configs,
    ...options,
  });
}

/**
 * Create a rate limiter with custom storage
 */
export function createRateLimiterWithStorage(
  storage: RateLimitStorage,
  configs: RateLimitConfig[],
  options?: Partial<RateLimiterOptions>
): RateLimiter {
  return new RateLimiter({
    storage,
    configs,
    ...options,
  });
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export { DefaultClock };
export { ErrorFactory };
