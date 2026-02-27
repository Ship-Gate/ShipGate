/**
 * Rate Limiter
 * 
 * Token bucket and sliding window rate limiting.
 */

export interface RateLimitConfig {
  /** Rate limit algorithm */
  algorithm: 'token_bucket' | 'sliding_window' | 'fixed_window';
  /** Requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Burst limit (for token bucket) */
  burst?: number;
  /** Per-behavior limits */
  behaviorLimits?: Record<string, number>;
  /** Per-client limits */
  clientLimits?: Record<string, number>;
  /** Exempt clients */
  exemptClients?: string[];
}

export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Remaining requests */
  remaining: number;
  /** Reset timestamp (Unix seconds) */
  resetAt: number;
  /** Limit that was applied */
  limit: number;
  /** Current usage */
  current: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface SlidingWindowEntry {
  count: number;
  timestamps: number[];
}

/**
 * Rate Limiter
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private tokenBuckets = new Map<string, TokenBucket>();
  private slidingWindows = new Map<string, SlidingWindowEntry>();
  private fixedWindows = new Map<string, { count: number; windowStart: number }>();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  async check(
    clientId: string,
    behaviorName?: string
  ): Promise<RateLimitResult> {
    // Check exemptions
    if (this.config.exemptClients?.includes(clientId)) {
      return {
        allowed: true,
        remaining: this.config.limit,
        resetAt: 0,
        limit: this.config.limit,
        current: 0,
      };
    }

    // Determine limit to apply
    const limit = this.getLimit(clientId, behaviorName);

    // Apply appropriate algorithm
    switch (this.config.algorithm) {
      case 'token_bucket':
        return this.checkTokenBucket(clientId, limit);
      case 'sliding_window':
        return this.checkSlidingWindow(clientId, limit);
      case 'fixed_window':
        return this.checkFixedWindow(clientId, limit);
      default:
        return this.checkTokenBucket(clientId, limit);
    }
  }

  /**
   * Get applicable limit
   */
  private getLimit(clientId: string, behaviorName?: string): number {
    // Check client-specific limit
    if (this.config.clientLimits?.[clientId]) {
      return this.config.clientLimits[clientId];
    }

    // Check behavior-specific limit
    if (behaviorName && this.config.behaviorLimits?.[behaviorName]) {
      return this.config.behaviorLimits[behaviorName];
    }

    return this.config.limit;
  }

  /**
   * Token bucket algorithm
   */
  private checkTokenBucket(clientId: string, limit: number): RateLimitResult {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;
    const burst = this.config.burst ?? limit;
    const refillRate = limit / this.config.windowSeconds;

    let bucket = this.tokenBuckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: burst, lastRefill: now };
      this.tokenBuckets.set(clientId, bucket);
    }

    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * refillRate;
    bucket.tokens = Math.min(burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if allowed
    const allowed = bucket.tokens >= 1;

    if (allowed) {
      bucket.tokens -= 1;
    }

    const resetAt = Math.ceil((now + windowMs) / 1000);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetAt,
      limit: burst,
      current: burst - Math.floor(bucket.tokens),
    };
  }

  /**
   * Sliding window algorithm
   */
  private checkSlidingWindow(clientId: string, limit: number): RateLimitResult {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;
    const windowStart = now - windowMs;

    let entry = this.slidingWindows.get(clientId);

    if (!entry) {
      entry = { count: 0, timestamps: [] };
      this.slidingWindows.set(clientId, entry);
    }

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    entry.count = entry.timestamps.length;

    // Check if allowed
    const allowed = entry.count < limit;

    if (allowed) {
      entry.timestamps.push(now);
      entry.count++;
    }

    const resetAt = Math.ceil((now + windowMs) / 1000);

    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt,
      limit,
      current: entry.count,
    };
  }

  /**
   * Fixed window algorithm
   */
  private checkFixedWindow(clientId: string, limit: number): RateLimitResult {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs) * windowMs;

    let entry = this.fixedWindows.get(clientId);

    // Reset if in new window
    if (!entry || entry.windowStart !== currentWindow) {
      entry = { count: 0, windowStart: currentWindow };
      this.fixedWindows.set(clientId, entry);
    }

    // Check if allowed
    const allowed = entry.count < limit;

    if (allowed) {
      entry.count++;
    }

    const resetAt = Math.ceil((currentWindow + windowMs) / 1000);

    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt,
      limit,
      current: entry.count,
    };
  }

  /**
   * Reset limits for a client
   */
  reset(clientId: string): void {
    this.tokenBuckets.delete(clientId);
    this.slidingWindows.delete(clientId);
    this.fixedWindows.delete(clientId);
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.tokenBuckets.clear();
    this.slidingWindows.clear();
    this.fixedWindows.clear();
  }

  /**
   * Get current usage for a client
   */
  getUsage(clientId: string): { current: number; limit: number } | null {
    const limit = this.getLimit(clientId);

    switch (this.config.algorithm) {
      case 'token_bucket': {
        const bucket = this.tokenBuckets.get(clientId);
        if (!bucket) return null;
        return {
          current: (this.config.burst ?? limit) - Math.floor(bucket.tokens),
          limit: this.config.burst ?? limit,
        };
      }
      case 'sliding_window': {
        const entry = this.slidingWindows.get(clientId);
        if (!entry) return null;
        return { current: entry.count, limit };
      }
      case 'fixed_window': {
        const entry = this.fixedWindows.get(clientId);
        if (!entry) return null;
        return { current: entry.count, limit };
      }
      default:
        return null;
    }
  }
}

/**
 * Create a rate limiter
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
