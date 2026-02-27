/**
 * Rate Limit Injector
 * 
 * Simulates rate limiting scenarios: burst protection, throttling, quota exhaustion.
 * Used for testing system behavior under rate limit storms.
 */

import type { Timeline } from '../timeline.js';

export type RateLimitAction = 'reject' | 'queue' | 'drop';

export interface RateLimitInjectorConfig {
  /** Maximum requests allowed per window */
  requestsPerWindow: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Burst limit (additional requests allowed in short burst) */
  burstLimit?: number;
  /** Burst window in milliseconds */
  burstWindowMs?: number;
  /** Action to take when rate limited */
  action?: RateLimitAction;
  /** Delay when queueing requests (ms) */
  queueDelayMs?: number;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** HTTP status code to return on rejection */
  statusCode?: number;
  /** Retry-After header value in seconds */
  retryAfter?: number;
}

export interface RateLimitInjectorState {
  active: boolean;
  totalRequests: number;
  acceptedRequests: number;
  rejectedRequests: number;
  queuedRequests: number;
  droppedRequests: number;
  currentWindowRequests: number;
  currentBurstRequests: number;
  windowStartTime: number;
  burstStartTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  action: RateLimitAction | 'allowed';
  remainingRequests: number;
  resetAfterMs: number;
  retryAfterMs?: number;
  statusCode?: number;
}

/**
 * Rate limit injector for chaos testing
 */
export class RateLimitInjector {
  private config: Required<RateLimitInjectorConfig>;
  private state: RateLimitInjectorState;
  private timeline: Timeline | null = null;
  private queue: Array<() => void> = [];
  private requestTimestamps: number[] = [];

  constructor(config: RateLimitInjectorConfig) {
    this.config = {
      requestsPerWindow: config.requestsPerWindow,
      windowMs: config.windowMs,
      burstLimit: config.burstLimit ?? Math.floor(config.requestsPerWindow * 0.2),
      burstWindowMs: config.burstWindowMs ?? Math.floor(config.windowMs / 10),
      action: config.action ?? 'reject',
      queueDelayMs: config.queueDelayMs ?? 1000,
      maxQueueSize: config.maxQueueSize ?? 100,
      statusCode: config.statusCode ?? 429,
      retryAfter: config.retryAfter ?? Math.ceil(config.windowMs / 1000),
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): RateLimitInjectorState {
    const now = Date.now();
    return {
      active: false,
      totalRequests: 0,
      acceptedRequests: 0,
      rejectedRequests: 0,
      queuedRequests: 0,
      droppedRequests: 0,
      currentWindowRequests: 0,
      currentBurstRequests: 0,
      windowStartTime: now,
      burstStartTime: now,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Activate the rate limit injector
   */
  activate(): void {
    if (this.state.active) return;

    this.state = this.createInitialState();
    this.state.active = true;
    this.queue = [];
    this.requestTimestamps = [];

    this.timeline?.record('injection_start', {
      injector: 'rate_limit',
      config: this.config,
    });
  }

  /**
   * Deactivate the rate limit injector
   */
  deactivate(): void {
    if (!this.state.active) return;

    // Clear any pending queued requests
    this.queue = [];
    this.state.active = false;
    this.timeline?.record('injection_end', {
      injector: 'rate_limit',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): RateLimitInjectorState {
    return { ...this.state };
  }

  /**
   * Check if a new request should be rate limited
   */
  checkRateLimit(): RateLimitResult {
    if (!this.state.active) {
      return {
        allowed: true,
        action: 'allowed',
        remainingRequests: this.config.requestsPerWindow,
        resetAfterMs: 0,
      };
    }

    const now = Date.now();
    this.state.totalRequests++;

    // Update windows
    this.updateWindows(now);

    // Check if within limits
    const withinWindowLimit = this.state.currentWindowRequests < this.config.requestsPerWindow;

    if (withinWindowLimit) {
      // Request is allowed
      this.state.currentWindowRequests++;
      this.state.currentBurstRequests++;
      this.state.acceptedRequests++;
      this.requestTimestamps.push(now);

      const remaining = this.config.requestsPerWindow - this.state.currentWindowRequests;
      const resetAfterMs = this.config.windowMs - (now - this.state.windowStartTime);

      this.timeline?.record('rate_limit_check', {
        allowed: true,
        remaining,
        resetAfterMs,
      });

      return {
        allowed: true,
        action: 'allowed',
        remainingRequests: remaining,
        resetAfterMs,
      };
    }

    // Rate limited - handle based on action
    const resetAfterMs = this.config.windowMs - (now - this.state.windowStartTime);
    const retryAfterMs = resetAfterMs;

    switch (this.config.action) {
      case 'queue':
        return this.handleQueue(resetAfterMs, retryAfterMs);
      
      case 'drop':
        return this.handleDrop(resetAfterMs);
      
      case 'reject':
      default:
        return this.handleReject(resetAfterMs, retryAfterMs);
    }
  }

  /**
   * Update window counters
   */
  private updateWindows(now: number): void {
    // Reset window if expired
    if (now - this.state.windowStartTime >= this.config.windowMs) {
      this.state.windowStartTime = now;
      this.state.currentWindowRequests = 0;
      
      // Clean old timestamps
      const windowStart = now - this.config.windowMs;
      this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
    }

    // Reset burst window if expired
    if (now - this.state.burstStartTime >= this.config.burstWindowMs) {
      this.state.burstStartTime = now;
      this.state.currentBurstRequests = 0;
    }
  }

  /**
   * Handle queue action
   */
  private handleQueue(resetAfterMs: number, _retryAfterMs: number): RateLimitResult {
    if (this.queue.length >= this.config.maxQueueSize) {
      // Queue is full, drop the request
      return this.handleDrop(resetAfterMs);
    }

    this.state.queuedRequests++;
    
    this.timeline?.record('rate_limit_queued', {
      queuePosition: this.queue.length + 1,
      estimatedWaitMs: this.config.queueDelayMs,
    });

    return {
      allowed: false,
      action: 'queue',
      remainingRequests: 0,
      resetAfterMs,
      retryAfterMs: this.config.queueDelayMs,
    };
  }

  /**
   * Handle drop action
   */
  private handleDrop(resetAfterMs: number): RateLimitResult {
    this.state.droppedRequests++;

    this.timeline?.record('rate_limit_dropped', {
      totalDropped: this.state.droppedRequests,
    });

    return {
      allowed: false,
      action: 'drop',
      remainingRequests: 0,
      resetAfterMs,
    };
  }

  /**
   * Handle reject action
   */
  private handleReject(resetAfterMs: number, retryAfterMs: number): RateLimitResult {
    this.state.rejectedRequests++;

    this.timeline?.record('rate_limit_rejected', {
      statusCode: this.config.statusCode,
      retryAfterMs,
      totalRejected: this.state.rejectedRequests,
    });

    return {
      allowed: false,
      action: 'reject',
      remainingRequests: 0,
      resetAfterMs,
      retryAfterMs,
      statusCode: this.config.statusCode,
    };
  }

  /**
   * Wrap an async operation with rate limiting
   */
  async wrap<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.checkRateLimit();

    if (result.allowed) {
      return operation();
    }

    switch (result.action) {
      case 'queue':
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, result.retryAfterMs ?? this.config.queueDelayMs));
        return this.wrap(operation);

      case 'drop':
        // Silently fail
        throw new RateLimitError('Request dropped due to rate limiting', {
          statusCode: this.config.statusCode,
          retryAfter: undefined,
          remaining: 0,
        });

      case 'reject':
      default:
        throw new RateLimitError('Rate limit exceeded', {
          statusCode: result.statusCode ?? this.config.statusCode,
          retryAfter: result.retryAfterMs,
          remaining: 0,
        });
    }
  }

  /**
   * Simulate a burst of requests
   */
  async simulateBurst(count: number, delayBetweenMs: number = 0): Promise<RateLimitResult[]> {
    const results: RateLimitResult[] = [];

    for (let i = 0; i < count; i++) {
      results.push(this.checkRateLimit());
      
      if (delayBetweenMs > 0 && i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
      }
    }

    this.timeline?.record('rate_limit_burst', {
      requestCount: count,
      accepted: results.filter(r => r.allowed).length,
      rejected: results.filter(r => !r.allowed).length,
    });

    return results;
  }

  /**
   * Get current request rate (requests per second)
   */
  getCurrentRate(): number {
    const now = Date.now();
    const windowStart = now - 1000; // Last second
    const recentRequests = this.requestTimestamps.filter(ts => ts > windowStart);
    return recentRequests.length;
  }

  /**
   * Get rate limit statistics
   */
  getStats(): {
    acceptanceRate: number;
    rejectionRate: number;
    averageRequestsPerWindow: number;
    peakRequestsPerWindow: number;
  } {
    const total = this.state.totalRequests || 1;
    return {
      acceptanceRate: this.state.acceptedRequests / total,
      rejectionRate: this.state.rejectedRequests / total,
      averageRequestsPerWindow: this.state.acceptedRequests,
      peakRequestsPerWindow: this.config.requestsPerWindow,
    };
  }
}

/**
 * Error class for rate limit rejections
 */
export class RateLimitError extends Error {
  public readonly statusCode: number;
  public readonly retryAfter?: number;
  public readonly remaining: number;

  constructor(
    message: string,
    options: { statusCode: number; retryAfter?: number; remaining: number }
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = options.statusCode;
    this.retryAfter = options.retryAfter;
    this.remaining = options.remaining;
  }
}

/**
 * Create a rate limit storm injector
 */
export function createRateLimitStorm(
  requestsPerWindow: number,
  windowMs: number = 1000
): RateLimitInjector {
  return new RateLimitInjector({
    requestsPerWindow,
    windowMs,
    action: 'reject',
  });
}

/**
 * Create a throttling injector
 */
export function createThrottler(
  requestsPerSecond: number,
  queueDelayMs: number = 100
): RateLimitInjector {
  return new RateLimitInjector({
    requestsPerWindow: requestsPerSecond,
    windowMs: 1000,
    action: 'queue',
    queueDelayMs,
  });
}

/**
 * Create a strict rate limiter that drops excess requests
 */
export function createStrictRateLimiter(
  requestsPerWindow: number,
  windowMs: number
): RateLimitInjector {
  return new RateLimitInjector({
    requestsPerWindow,
    windowMs,
    action: 'drop',
  });
}

/**
 * Create a burst-tolerant rate limiter
 */
export function createBurstTolerantRateLimiter(
  requestsPerWindow: number,
  windowMs: number,
  burstMultiplier: number = 2
): RateLimitInjector {
  return new RateLimitInjector({
    requestsPerWindow,
    windowMs,
    burstLimit: Math.floor(requestsPerWindow * burstMultiplier),
    burstWindowMs: Math.floor(windowMs / 10),
    action: 'reject',
  });
}
