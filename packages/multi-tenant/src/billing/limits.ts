/**
 * Limit Enforcement
 * 
 * Enforce usage limits and quotas for tenants.
 */

import { TenantContext } from '../context.js';
import type { Tenant, PlanType } from '../tenant.js';
import type { UsageTracker, UsageMetric } from './usage.js';

// ============================================================================
// Types
// ============================================================================

export interface LimitConfig {
  metric: UsageMetric;
  softLimit?: number;
  hardLimit: number;
  gracePeriodMs?: number;
  onSoftLimitReached?: (tenant: Tenant, current: number) => void;
  onHardLimitReached?: (tenant: Tenant, current: number) => void;
}

export interface EnforcementResult {
  allowed: boolean;
  metric: UsageMetric;
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  warning?: string;
  error?: string;
}

export interface LimitViolation {
  tenantId: string;
  metric: UsageMetric;
  current: number;
  limit: number;
  violationType: 'soft' | 'hard';
  timestamp: Date;
}

// ============================================================================
// Limit Enforcer
// ============================================================================

export class LimitEnforcer {
  private tracker: UsageTracker;
  private limits: Map<UsageMetric, LimitConfig> = new Map();
  private violations: LimitViolation[] = [];

  constructor(tracker: UsageTracker) {
    this.tracker = tracker;
  }

  /**
   * Register a limit configuration
   */
  registerLimit(config: LimitConfig): void {
    this.limits.set(config.metric, config);
  }

  /**
   * Check if an operation is allowed
   */
  async check(metric: UsageMetric): Promise<EnforcementResult> {
    const tenant = TenantContext.getTenant();
    return this.checkForTenant(tenant, metric);
  }

  /**
   * Check limit for a specific tenant
   */
  async checkForTenant(
    tenant: Tenant,
    metric: UsageMetric
  ): Promise<EnforcementResult> {
    const allowed = await this.tracker.checkLimit(tenant.id, metric);
    const usage = await this.tracker.getUsage(tenant.id);
    
    const current = usage.metrics[metric] ?? 0;
    const limit = usage.limits[metric] ?? -1;
    const percentage = usage.percentages[metric] ?? 0;
    const remaining = limit === -1 ? Infinity : Math.max(0, limit - current);

    const config = this.limits.get(metric);
    let warning: string | undefined;
    let error: string | undefined;

    // Check soft limit
    if (config?.softLimit && current >= config.softLimit && current < config.hardLimit) {
      warning = `Approaching ${metric} limit: ${percentage.toFixed(1)}% used`;
      config.onSoftLimitReached?.(tenant, current);
      this.recordViolation(tenant.id, metric, current, config.softLimit, 'soft');
    }

    // Check hard limit
    if (!allowed) {
      error = `${metric} limit exceeded: ${current}/${limit}`;
      config?.onHardLimitReached?.(tenant, current);
      this.recordViolation(tenant.id, metric, current, limit, 'hard');
    }

    return {
      allowed,
      metric,
      current,
      limit,
      remaining,
      percentage,
      warning,
      error,
    };
  }

  /**
   * Enforce a limit (throw if exceeded)
   */
  async enforce(metric: UsageMetric): Promise<void> {
    const result = await this.check(metric);
    
    if (!result.allowed) {
      throw new LimitExceededError(metric, result.current, result.limit);
    }
  }

  /**
   * Enforce and increment usage
   */
  async enforceAndIncrement(
    metric: UsageMetric,
    by: number = 1
  ): Promise<EnforcementResult> {
    const result = await this.check(metric);
    
    if (!result.allowed) {
      throw new LimitExceededError(metric, result.current, result.limit);
    }

    const tenant = TenantContext.getTenant();
    await this.tracker.increment(tenant.id, metric, by);

    // Return updated result
    return this.check(metric);
  }

  /**
   * Get all limit violations for a tenant
   */
  getViolations(tenantId: string): LimitViolation[] {
    return this.violations.filter(v => v.tenantId === tenantId);
  }

  /**
   * Clear violation history
   */
  clearViolations(tenantId?: string): void {
    if (tenantId) {
      this.violations = this.violations.filter(v => v.tenantId !== tenantId);
    } else {
      this.violations = [];
    }
  }

  private recordViolation(
    tenantId: string,
    metric: UsageMetric,
    current: number,
    limit: number,
    type: 'soft' | 'hard'
  ): void {
    this.violations.push({
      tenantId,
      metric,
      current,
      limit,
      violationType: type,
      timestamp: new Date(),
    });

    // Keep only last 1000 violations
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-1000);
    }
  }
}

// ============================================================================
// Quota Manager
// ============================================================================

export class QuotaManager {
  private enforcer: LimitEnforcer;
  private quotas: Map<string, QuotaConfig> = new Map();

  constructor(enforcer: LimitEnforcer) {
    this.enforcer = enforcer;
  }

  /**
   * Define a quota configuration
   */
  defineQuota(name: string, config: QuotaConfig): void {
    this.quotas.set(name, config);
  }

  /**
   * Check if a quota allows an operation
   */
  async checkQuota(
    name: string,
    amount: number = 1
  ): Promise<{ allowed: boolean; remaining: number }> {
    const config = this.quotas.get(name);
    if (!config) {
      return { allowed: true, remaining: Infinity };
    }

    const tenant = TenantContext.getTenant();
    const planConfig = config.plans[tenant.plan];
    
    if (!planConfig) {
      return { allowed: true, remaining: Infinity };
    }

    const result = await this.enforcer.checkForTenant(tenant, config.metric);
    const effectiveLimit = planConfig.limit ?? result.limit;
    const remaining = effectiveLimit === -1 ? Infinity : effectiveLimit - result.current;

    return {
      allowed: remaining >= amount,
      remaining,
    };
  }

  /**
   * Consume quota
   */
  async consumeQuota(name: string, amount: number = 1): Promise<void> {
    const { allowed, remaining } = await this.checkQuota(name, amount);
    
    if (!allowed) {
      throw new QuotaExceededError(name, amount, remaining);
    }

    const config = this.quotas.get(name);
    if (config) {
      await this.enforcer.enforceAndIncrement(config.metric, amount);
    }
  }
}

export interface QuotaConfig {
  metric: UsageMetric;
  plans: Record<PlanType, { limit: number } | undefined>;
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class TenantRateLimiter {
  private windows = new Map<string, RateLimitWindow>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(key?: string): Promise<RateLimitResult> {
    const tenant = TenantContext.getTenant();
    const windowKey = key ? `${tenant.id}:${key}` : tenant.id;
    
    const now = Date.now();
    let window = this.windows.get(windowKey);

    // Get limit for tenant's plan
    const limit = this.config.limitsPerPlan?.[tenant.plan] ?? this.config.defaultLimit;

    // Create or reset window
    if (!window || now > window.resetAt) {
      window = {
        count: 0,
        resetAt: now + this.config.windowMs,
      };
      this.windows.set(windowKey, window);
    }

    // Check limit
    if (window.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: window.resetAt,
        retryAfter: window.resetAt - now,
      };
    }

    // Increment counter
    window.count++;

    return {
      allowed: true,
      limit,
      remaining: limit - window.count,
      resetAt: window.resetAt,
    };
  }

  /**
   * Enforce rate limit (throw if exceeded)
   */
  async enforce(key?: string): Promise<void> {
    const result = await this.isAllowed(key);
    
    if (!result.allowed) {
      throw new RateLimitExceededError(result.retryAfter!);
    }
  }

  /**
   * Reset rate limit for a tenant
   */
  reset(tenantId: string, key?: string): void {
    const windowKey = key ? `${tenantId}:${key}` : tenantId;
    this.windows.delete(windowKey);
  }

  /**
   * Clean up expired windows
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now > window.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  windowMs: number;
  defaultLimit: number;
  limitsPerPlan?: Partial<Record<PlanType, number>>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// Errors
// ============================================================================

export class LimitExceededError extends Error {
  constructor(
    public readonly metric: UsageMetric,
    public readonly current: number,
    public readonly limit: number
  ) {
    super(`Limit exceeded for ${metric}: ${current}/${limit}`);
    this.name = 'LimitExceededError';
  }
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly quota: string,
    public readonly requested: number,
    public readonly remaining: number
  ) {
    super(`Quota exceeded for ${quota}: requested ${requested}, remaining ${remaining}`);
    this.name = 'QuotaExceededError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}ms`);
    this.name = 'RateLimitExceededError';
  }
}
