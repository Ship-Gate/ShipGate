// ============================================================================
// ISL Standard Library - Rate Limiter
// @stdlib/rate-limit/rate-limiter
// Version: 1.0.0
// ============================================================================

import { randomUUID } from 'crypto';
import {
  RateLimitAction,
  RateLimitAlgorithm,
  IdentifierType,
  type RateLimitConfig,
  type RateLimitBucket,
  type RateLimitBlock,
  type CheckResult,
  type CheckInput,
  type IncrementInput,
  type IncrementResult,
  type BlockInput,
  type UnblockInput,
  type BucketState,
  type Violation,
  type RateLimitStorage,
  type RateLimiterOptions,
  type BucketId,
} from './types';

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private storage: RateLimitStorage;
  private configs: Map<string, RateLimitConfig>;
  private options: Required<Omit<RateLimiterOptions, 'onViolation' | 'onBlock' | 'onError' | 'skip'>> &
    Pick<RateLimiterOptions, 'onViolation' | 'onBlock' | 'onError' | 'skip'>;

  constructor(options: RateLimiterOptions) {
    this.storage = options.storage;
    this.configs = new Map(options.configs.map(c => [c.name, c]));
    
    this.options = {
      storage: options.storage,
      configs: options.configs,
      defaultConfig: options.defaultConfig ?? options.configs[0]?.name ?? 'default',
      keyGenerator: options.keyGenerator ?? this.defaultKeyGenerator,
      includeHeaders: options.includeHeaders ?? true,
      headerPrefix: options.headerPrefix ?? 'X-RateLimit',
      enableEscalation: options.enableEscalation ?? true,
      maxEscalationLevel: options.maxEscalationLevel ?? 5,
      onViolation: options.onViolation,
      onBlock: options.onBlock,
      onError: options.onError,
      skip: options.skip,
    };
  }

  // ==========================================================================
  // CHECK METHODS
  // ==========================================================================

  /**
   * Check if a request should be allowed
   */
  async check(input: CheckInput): Promise<CheckResult> {
    try {
      // Check skip conditions
      if (this.options.skip && await this.options.skip(input)) {
        return this.createAllowResult(input, Infinity);
      }

      const config = this.getConfigOrDefault(input.configName);
      if (!config) {
        throw new Error(`Rate limit config not found: ${input.configName}`);
      }

      // Check bypass rules
      if (this.shouldBypass(input, config)) {
        return this.createAllowResult(input, config.limit);
      }

      // Check if blocked
      const block = await this.storage.getBlock(input.key, input.identifierType);
      if (block && block.blockedUntil > new Date()) {
        return this.createDenyResult(input, config, block);
      }

      // Get or create bucket
      const bucketId = this.options.keyGenerator(input);
      let bucket = await this.storage.getBucket(bucketId);
      
      if (!bucket) {
        bucket = this.createNewBucket(bucketId, input, config);
        await this.storage.setBucket(bucket);
      } else {
        // Check if window has expired
        bucket = this.maybeResetWindow(bucket, config);
      }

      // Calculate result
      const weight = input.weight ?? 1;
      const remaining = Math.max(0, config.limit - bucket.currentCount);
      const wouldExceed = bucket.currentCount + weight > config.limit;

      // Determine action
      const action = this.determineAction(bucket, config, weight);
      
      return {
        action,
        allowed: action === RateLimitAction.ALLOW || action === RateLimitAction.WARN,
        remaining,
        limit: config.limit,
        resetAt: new Date(bucket.windowStart.getTime() + config.windowMs),
        retryAfterMs: wouldExceed ? config.windowMs - (Date.now() - bucket.windowStart.getTime()) : undefined,
        headers: this.options.includeHeaders ? this.createHeaders(config, remaining, bucket) : undefined,
        bucketKey: bucketId,
        configName: config.name,
        violationCount: bucket.violationCount,
      };
    } catch (error) {
      this.options.onError?.(error as Error, 'check');
      // Fail open - allow request on error
      return this.createAllowResult(input, 0);
    }
  }

  /**
   * Increment counter after request completes
   */
  async increment(input: IncrementInput): Promise<IncrementResult> {
    try {
      const config = this.getConfigOrDefault(input.configName);
      if (!config) {
        throw new Error(`Rate limit config not found: ${input.configName}`);
      }

      const bucketId = this.options.keyGenerator({
        ...input,
        weight: input.amount,
      });

      const bucket = await this.storage.incrementBucket(bucketId, input.amount ?? 1);
      const remaining = Math.max(0, config.limit - bucket.currentCount);
      const action = this.determineAction(bucket, config, 0);

      // Record violation if limit exceeded
      if (bucket.currentCount > config.limit) {
        await this.handleViolation(input, config, bucket);
      }

      return {
        newCount: bucket.currentCount,
        remaining,
        action,
      };
    } catch (error) {
      this.options.onError?.(error as Error, 'increment');
      return {
        newCount: 0,
        remaining: 0,
        action: RateLimitAction.ALLOW,
      };
    }
  }

  /**
   * Atomically check and increment
   */
  async checkAndIncrement(input: CheckInput): Promise<CheckResult> {
    const checkResult = await this.check(input);

    if (checkResult.allowed) {
      const incResult = await this.increment({
        key: input.key,
        identifierType: input.identifierType,
        configName: input.configName,
        amount: input.weight ?? 1,
      });
      return {
        ...checkResult,
        remaining: incResult.remaining,
      };
    }

    if (checkResult.action === RateLimitAction.DENY) {
      const config = this.getConfigOrDefault(input.configName);
      if (config) {
        const violation: Violation = {
          id: randomUUID(),
          key: input.key,
          identifierType: input.identifierType,
          configName: config.name,
          timestamp: new Date(),
          requestCount: config.limit + 1,
          limit: config.limit,
          actionTaken: RateLimitAction.DENY,
        };
        await this.storage.recordViolation(violation);
        this.options.onViolation?.(violation);
      }
    }

    return checkResult;
  }

  /**
   * Get current bucket status
   */
  async getStatus(input: { key: string; identifierType: IdentifierType; configName: string }): Promise<{
    bucket: RateLimitBucket | null;
    state: BucketState;
    isBlocked: boolean;
    blockExpiresAt?: Date;
  }> {
    const config = this.getConfigOrDefault(input.configName);
    if (!config) {
      throw new Error(`Rate limit config not found: ${input.configName}`);
    }

    const bucketId = this.options.keyGenerator({ ...input, weight: 1 });
    const bucket = await this.storage.getBucket(bucketId);
    const block = await this.storage.getBlock(input.key, input.identifierType);
    const isBlocked = !!block && block.blockedUntil > new Date();

    const now = new Date();
    const windowStart = bucket?.windowStart ?? now;
    const windowEnd = new Date(windowStart.getTime() + config.windowMs);

    return {
      bucket,
      state: {
        key: input.key,
        configName: input.configName,
        currentCount: bucket?.currentCount ?? 0,
        remaining: Math.max(0, config.limit - (bucket?.currentCount ?? 0)),
        limit: config.limit,
        windowStart,
        windowEnd,
        lastRequest: bucket?.updatedAt ?? now,
        blockedUntil: isBlocked ? block.blockedUntil : undefined,
        violationCount: bucket?.violationCount ?? 0,
      },
      isBlocked,
      blockExpiresAt: isBlocked ? block.blockedUntil : undefined,
    };
  }

  // ==========================================================================
  // BLOCK METHODS
  // ==========================================================================

  /**
   * Block an identifier
   */
  async block(input: BlockInput): Promise<RateLimitBlock> {
    const existing = await this.storage.getBlock(input.key, input.identifierType);
    if (existing && existing.blockedUntil > new Date()) {
      throw new Error('Identifier is already blocked');
    }

    const block: RateLimitBlock = {
      id: randomUUID(),
      key: input.key,
      identifierType: input.identifierType,
      reason: input.reason,
      blockedAt: new Date(),
      blockedUntil: new Date(Date.now() + input.durationMs),
      autoUnblock: input.autoUnblock ?? true,
      createdBy: input.createdBy,
      metadata: input.metadata,
    };

    await this.storage.setBlock(block);
    this.options.onBlock?.(block);

    return block;
  }

  /**
   * Unblock an identifier
   */
  async unblock(input: UnblockInput): Promise<{ unblocked: boolean; wasBlockedUntil?: Date }> {
    const block = await this.storage.getBlock(input.key, input.identifierType);
    if (!block) {
      throw new Error('Identifier is not blocked');
    }

    const wasBlockedUntil = block.blockedUntil;
    await this.storage.removeBlock(input.key, input.identifierType);

    return { unblocked: true, wasBlockedUntil };
  }

  /**
   * Check if blocked
   */
  async isBlocked(key: string, identifierType: IdentifierType): Promise<{
    blocked: boolean;
    block?: RateLimitBlock;
    expiresAt?: Date;
    reason?: string;
  }> {
    const block = await this.storage.getBlock(key, identifierType);
    const isBlocked = !!block && block.blockedUntil > new Date();

    return {
      blocked: isBlocked,
      block: isBlocked ? block : undefined,
      expiresAt: isBlocked ? block.blockedUntil : undefined,
      reason: isBlocked ? block.reason : undefined,
    };
  }

  /**
   * List active blocks
   */
  async listBlocks(options?: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: RateLimitBlock[]; total: number; hasMore: boolean }> {
    const result = await this.storage.listBlocks(options);
    const limit = options?.limit ?? 100;
    
    return {
      blocks: result.blocks,
      total: result.total,
      hasMore: result.total > (options?.offset ?? 0) + result.blocks.length,
    };
  }

  // ==========================================================================
  // CONFIG METHODS
  // ==========================================================================

  /**
   * Add or update a config
   */
  addConfig(config: RateLimitConfig): void {
    this.configs.set(config.name, config);
  }

  /**
   * Remove a config
   */
  removeConfig(name: string): boolean {
    return this.configs.delete(name);
  }

  /**
   * Get a config by name (returns undefined if name not found; use listConfigs for default)
   */
  getConfig(name: string): RateLimitConfig | undefined {
    return this.configs.get(name);
  }

  /**
   * Get config by name, falling back to default config when not found
   */
  getConfigOrDefault(name: string): RateLimitConfig | undefined {
    return this.configs.get(name) ?? this.configs.get(this.options.defaultConfig);
  }

  /**
   * List all configs
   */
  listConfigs(): RateLimitConfig[] {
    return Array.from(this.configs.values());
  }

  // ==========================================================================
  // VIOLATION METHODS
  // ==========================================================================

  /**
   * Get violation history
   */
  async getViolationHistory(options?: {
    key?: string;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  }): Promise<{ violations: Violation[]; total: number; uniqueKeys: number }> {
    const result = await this.storage.getViolations(options);
    const uniqueKeys = new Set(result.violations.map(v => v.key)).size;
    
    return {
      violations: result.violations,
      total: result.total,
      uniqueKeys,
    };
  }

  // ==========================================================================
  // HEALTH & CLEANUP
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    return this.storage.healthCheck();
  }

  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    return this.storage.cleanup(olderThanMs);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private defaultKeyGenerator(input: CheckInput): BucketId {
    return `${input.configName}:${input.identifierType}:${input.key}`;
  }

  private createNewBucket(
    bucketId: BucketId,
    input: CheckInput,
    config: RateLimitConfig
  ): RateLimitBucket {
    const now = new Date();
    return {
      id: bucketId,
      key: input.key,
      identifierType: input.identifierType,
      configName: config.name,
      currentCount: 0,
      totalRequests: 0,
      windowStart: now,
      windowSizeMs: config.windowMs,
      limit: config.limit,
      violationCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private maybeResetWindow(bucket: RateLimitBucket, config: RateLimitConfig): RateLimitBucket {
    const now = Date.now();
    const windowEnd = bucket.windowStart.getTime() + config.windowMs;
    
    if (now > windowEnd) {
      // Window expired, reset counter
      return {
        ...bucket,
        currentCount: 0,
        windowStart: new Date(),
        updatedAt: new Date(),
      };
    }
    
    return bucket;
  }

  private determineAction(
    bucket: RateLimitBucket,
    config: RateLimitConfig,
    weight: number
  ): RateLimitAction {
    const usage = (bucket.currentCount + weight) / config.limit;
    
    if (usage > 1) {
      return RateLimitAction.DENY;
    }
    
    if (config.throttleThreshold && usage >= config.throttleThreshold) {
      return RateLimitAction.THROTTLE;
    }
    
    if (config.warnThreshold && usage >= config.warnThreshold) {
      return RateLimitAction.WARN;
    }
    
    return RateLimitAction.ALLOW;
  }

  private shouldBypass(input: CheckInput, config: RateLimitConfig): boolean {
    // Check bypass IPs
    if (config.bypassIps?.includes(input.key) && input.identifierType === IdentifierType.IP) {
      return true;
    }
    
    // Check bypass in metadata
    if (input.metadata?.role && config.bypassRoles?.includes(input.metadata.role)) {
      return true;
    }
    
    return false;
  }

  private createAllowResult(input: CheckInput, remaining: number): CheckResult {
    const config = this.getConfigOrDefault(input.configName ?? this.options.defaultConfig);

    return {
      action: RateLimitAction.ALLOW,
      allowed: true,
      remaining,
      limit: config?.limit ?? Infinity,
      resetAt: new Date(Date.now() + (config?.windowMs ?? 60000)),
      bucketKey: this.options.keyGenerator(input),
      configName: config?.name ?? this.options.defaultConfig,
    };
  }

  private createDenyResult(
    input: CheckInput,
    config: RateLimitConfig,
    block: RateLimitBlock
  ): CheckResult {
    return {
      action: RateLimitAction.DENY,
      allowed: false,
      remaining: 0,
      limit: config.limit,
      resetAt: block.blockedUntil,
      retryAfterMs: block.blockedUntil.getTime() - Date.now(),
      headers: this.options.includeHeaders ? {
        [`${this.options.headerPrefix}-Limit`]: String(config.limit),
        [`${this.options.headerPrefix}-Remaining`]: '0',
        [`${this.options.headerPrefix}-Reset`]: String(Math.ceil(block.blockedUntil.getTime() / 1000)),
        'Retry-After': String(Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000)),
      } : undefined,
      bucketKey: this.options.keyGenerator(input),
      configName: config.name,
    };
  }

  private createHeaders(
    config: RateLimitConfig,
    remaining: number,
    bucket: RateLimitBucket
  ): Record<string, string> {
    const resetAt = new Date(bucket.windowStart.getTime() + config.windowMs);
    
    return {
      [`${this.options.headerPrefix}-Limit`]: String(config.limit),
      [`${this.options.headerPrefix}-Remaining`]: String(remaining),
      [`${this.options.headerPrefix}-Reset`]: String(Math.ceil(resetAt.getTime() / 1000)),
      [`${this.options.headerPrefix}-Policy`]: `${config.limit};w=${Math.ceil(config.windowMs / 1000)}`,
    };
  }

  private async handleViolation(
    input: IncrementInput,
    config: RateLimitConfig,
    bucket: RateLimitBucket
  ): Promise<void> {
    const violation: Violation = {
      id: randomUUID(),
      key: input.key,
      identifierType: input.identifierType,
      configName: config.name,
      timestamp: new Date(),
      requestCount: bucket.currentCount,
      limit: config.limit,
      actionTaken: RateLimitAction.DENY,
    };

    await this.storage.recordViolation(violation);
    this.options.onViolation?.(violation);

    // Check for escalation
    if (this.options.enableEscalation && bucket.violationCount >= this.options.maxEscalationLevel) {
      const blockDuration = config.blockDurationMs ?? 60 * 60 * 1000; // Default 1 hour
      await this.block({
        key: input.key,
        identifierType: input.identifierType,
        durationMs: blockDuration * Math.pow(config.escalationMultiplier ?? 2, bucket.violationCount),
        reason: `Rate limit exceeded ${bucket.violationCount} times`,
      });
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}
