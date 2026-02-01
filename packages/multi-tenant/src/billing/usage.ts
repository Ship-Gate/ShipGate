/**
 * Usage Tracking
 * 
 * Track and manage resource usage per tenant.
 */

import { TenantContext } from '../context.js';
import type { Tenant, PlanType, TenantLimits } from '../tenant.js';

// ============================================================================
// Types
// ============================================================================

export type UsageMetric = 
  | 'apiCalls'
  | 'users'
  | 'storageMB'
  | 'behaviorExecutions'
  | 'dataTransferMB'
  | string;

export interface UsageRecord {
  tenantId: string;
  metric: UsageMetric;
  value: number;
  period: string; // YYYY-MM or YYYY-MM-DD
  updatedAt: Date;
}

export interface UsageSnapshot {
  tenantId: string;
  period: string;
  metrics: Record<UsageMetric, number>;
  limits: Record<UsageMetric, number>;
  percentages: Record<UsageMetric, number>;
  timestamp: Date;
}

export interface UsageTrackerConfig {
  storage: 'memory' | 'redis' | 'database';
  limits: Record<PlanType, Partial<Record<UsageMetric, number>>>;
  resetPeriod: 'daily' | 'monthly';
  alertThresholds?: number[];
  onThresholdReached?: (tenant: Tenant, metric: UsageMetric, percentage: number) => void;
}

export interface UsageStorage {
  get(tenantId: string, metric: UsageMetric, period: string): Promise<number>;
  set(tenantId: string, metric: UsageMetric, period: string, value: number): Promise<void>;
  increment(tenantId: string, metric: UsageMetric, period: string, by?: number): Promise<number>;
  getAll(tenantId: string, period: string): Promise<Record<UsageMetric, number>>;
  reset(tenantId: string, period: string): Promise<void>;
}

// ============================================================================
// Usage Tracker
// ============================================================================

export class UsageTracker {
  private storage: UsageStorage;
  private config: UsageTrackerConfig;

  constructor(config: UsageTrackerConfig) {
    this.config = {
      alertThresholds: [80, 90, 100],
      ...config,
    };
    this.storage = this.createStorage(config.storage);
  }

  /**
   * Check if an operation is allowed within limits
   */
  async checkLimit(
    tenantIdOrTenant: string | Tenant,
    metric: UsageMetric
  ): Promise<boolean> {
    const tenant = typeof tenantIdOrTenant === 'string'
      ? TenantContext.getTenant()
      : tenantIdOrTenant;
    
    const tenantId = typeof tenantIdOrTenant === 'string' 
      ? tenantIdOrTenant 
      : tenant.id;

    const limit = this.getLimit(tenant.plan, metric);
    
    // -1 means unlimited
    if (limit === -1) {
      return true;
    }

    const period = this.getCurrentPeriod();
    const current = await this.storage.get(tenantId, metric, period);
    
    return current < limit;
  }

  /**
   * Increment usage counter
   */
  async increment(
    tenantId: string,
    metric: UsageMetric,
    by: number = 1
  ): Promise<{ newValue: number; limit: number; percentage: number }> {
    const period = this.getCurrentPeriod();
    const newValue = await this.storage.increment(tenantId, metric, period, by);
    
    const tenant = TenantContext.tryGetTenant();
    const limit = tenant 
      ? this.getLimit(tenant.plan, metric)
      : this.getLimit('FREE', metric);

    const percentage = limit === -1 ? 0 : (newValue / limit) * 100;

    // Check thresholds
    if (tenant && this.config.onThresholdReached) {
      for (const threshold of this.config.alertThresholds ?? []) {
        if (percentage >= threshold) {
          this.config.onThresholdReached(tenant, metric, percentage);
        }
      }
    }

    return { newValue, limit, percentage };
  }

  /**
   * Get current usage for a tenant
   */
  async getUsage(tenantId: string): Promise<UsageSnapshot> {
    const period = this.getCurrentPeriod();
    const metrics = await this.storage.getAll(tenantId, period);
    
    const tenant = TenantContext.tryGetTenant();
    const plan = tenant?.plan ?? 'FREE';
    
    const limits: Record<UsageMetric, number> = {};
    const percentages: Record<UsageMetric, number> = {};

    for (const [metric, value] of Object.entries(metrics)) {
      const limit = this.getLimit(plan, metric);
      limits[metric] = limit;
      percentages[metric] = limit === -1 ? 0 : (value / limit) * 100;
    }

    return {
      tenantId,
      period,
      metrics,
      limits,
      percentages,
      timestamp: new Date(),
    };
  }

  /**
   * Reset usage for a tenant
   */
  async resetUsage(tenantId: string): Promise<void> {
    const period = this.getCurrentPeriod();
    await this.storage.reset(tenantId, period);
  }

  /**
   * Get remaining quota for a metric
   */
  async getRemaining(
    tenantId: string,
    metric: UsageMetric
  ): Promise<number> {
    const tenant = TenantContext.tryGetTenant();
    const limit = this.getLimit(tenant?.plan ?? 'FREE', metric);
    
    if (limit === -1) return Infinity;

    const period = this.getCurrentPeriod();
    const current = await this.storage.get(tenantId, metric, period);
    
    return Math.max(0, limit - current);
  }

  /**
   * Record a specific usage value (not increment)
   */
  async setUsage(
    tenantId: string,
    metric: UsageMetric,
    value: number
  ): Promise<void> {
    const period = this.getCurrentPeriod();
    await this.storage.set(tenantId, metric, period, value);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getLimit(plan: PlanType, metric: UsageMetric): number {
    const planLimits = this.config.limits[plan] ?? {};
    return planLimits[metric] ?? -1;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    if (this.config.resetPeriod === 'daily') {
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return `${year}-${month}`;
  }

  private createStorage(type: 'memory' | 'redis' | 'database'): UsageStorage {
    // Default to in-memory storage
    // Real implementations would use Redis or database
    return new InMemoryUsageStorage();
  }
}

// ============================================================================
// In-Memory Storage
// ============================================================================

export class InMemoryUsageStorage implements UsageStorage {
  private data = new Map<string, number>();

  private key(tenantId: string, metric: UsageMetric, period: string): string {
    return `${tenantId}:${metric}:${period}`;
  }

  async get(tenantId: string, metric: UsageMetric, period: string): Promise<number> {
    return this.data.get(this.key(tenantId, metric, period)) ?? 0;
  }

  async set(tenantId: string, metric: UsageMetric, period: string, value: number): Promise<void> {
    this.data.set(this.key(tenantId, metric, period), value);
  }

  async increment(tenantId: string, metric: UsageMetric, period: string, by: number = 1): Promise<number> {
    const key = this.key(tenantId, metric, period);
    const current = this.data.get(key) ?? 0;
    const newValue = current + by;
    this.data.set(key, newValue);
    return newValue;
  }

  async getAll(tenantId: string, period: string): Promise<Record<UsageMetric, number>> {
    const result: Record<UsageMetric, number> = {};
    const prefix = `${tenantId}:`;
    const suffix = `:${period}`;

    for (const [key, value] of this.data) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        const metric = key.slice(prefix.length, -suffix.length);
        result[metric] = value;
      }
    }

    return result;
  }

  async reset(tenantId: string, period: string): Promise<void> {
    const prefix = `${tenantId}:`;
    const suffix = `:${period}`;

    for (const key of this.data.keys()) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        this.data.delete(key);
      }
    }
  }

  clear(): void {
    this.data.clear();
  }
}

// ============================================================================
// Default Limits
// ============================================================================

export const DEFAULT_USAGE_LIMITS: Record<PlanType, Partial<Record<UsageMetric, number>>> = {
  FREE: {
    apiCalls: 1000,
    users: 5,
    storageMB: 100,
    behaviorExecutions: 500,
    dataTransferMB: 100,
  },
  STARTER: {
    apiCalls: 10000,
    users: 25,
    storageMB: 1000,
    behaviorExecutions: 5000,
    dataTransferMB: 1000,
  },
  PRO: {
    apiCalls: 100000,
    users: 100,
    storageMB: 10000,
    behaviorExecutions: 50000,
    dataTransferMB: 10000,
  },
  ENTERPRISE: {
    apiCalls: -1,
    users: -1,
    storageMB: -1,
    behaviorExecutions: -1,
    dataTransferMB: -1,
  },
};

/**
 * Create a default usage tracker
 */
export function createUsageTracker(
  customLimits?: Partial<Record<PlanType, Partial<Record<UsageMetric, number>>>>
): UsageTracker {
  const limits = { ...DEFAULT_USAGE_LIMITS };
  
  if (customLimits) {
    for (const [plan, planLimits] of Object.entries(customLimits)) {
      limits[plan as PlanType] = { ...limits[plan as PlanType], ...planLimits };
    }
  }

  return new UsageTracker({
    storage: 'memory',
    limits,
    resetPeriod: 'monthly',
    alertThresholds: [80, 90, 100],
  });
}
