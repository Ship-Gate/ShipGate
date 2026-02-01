/**
 * Tenant Management
 * 
 * Core tenant entity and management operations.
 */

// ============================================================================
// Types
// ============================================================================

export type PlanType = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING';
export type IsolationStrategy = 'row_level' | 'schema' | 'database';

export interface TenantLimits {
  maxUsers: number;
  maxStorageMB: number;
  maxApiCallsPerMonth: number;
  maxBehaviorsPerMinute: number;
  customLimits?: Record<string, number>;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: PlanType;
  limits: TenantLimits;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  settings?: TenantSettings;
}

export interface TenantSettings {
  timezone?: string;
  locale?: string;
  features?: string[];
  customDomain?: string;
  webhookUrl?: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: PlanType;
  settings?: TenantSettings;
  metadata?: Record<string, unknown>;
}

export interface UpdateTenantInput {
  name?: string;
  plan?: PlanType;
  limits?: Partial<TenantLimits>;
  settings?: Partial<TenantSettings>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Plan Limits
// ============================================================================

export const DEFAULT_PLAN_LIMITS: Record<PlanType, TenantLimits> = {
  FREE: {
    maxUsers: 5,
    maxStorageMB: 100,
    maxApiCallsPerMonth: 1000,
    maxBehaviorsPerMinute: 10,
  },
  STARTER: {
    maxUsers: 25,
    maxStorageMB: 1000,
    maxApiCallsPerMonth: 10000,
    maxBehaviorsPerMinute: 50,
  },
  PRO: {
    maxUsers: 100,
    maxStorageMB: 10000,
    maxApiCallsPerMonth: 100000,
    maxBehaviorsPerMinute: 200,
  },
  ENTERPRISE: {
    maxUsers: -1, // Unlimited
    maxStorageMB: -1,
    maxApiCallsPerMonth: -1,
    maxBehaviorsPerMinute: -1,
  },
};

// ============================================================================
// Tenant Repository Interface
// ============================================================================

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findAll(options?: { status?: TenantStatus; plan?: PlanType }): Promise<Tenant[]>;
  create(input: CreateTenantInput): Promise<Tenant>;
  update(id: string, input: UpdateTenantInput): Promise<Tenant>;
  delete(id: string): Promise<void>;
  suspend(id: string, reason?: string): Promise<Tenant>;
  activate(id: string): Promise<Tenant>;
}

// ============================================================================
// In-Memory Repository (for testing/development)
// ============================================================================

export class InMemoryTenantRepository implements TenantRepository {
  private tenants: Map<string, Tenant> = new Map();
  private slugIndex: Map<string, string> = new Map();

  async findById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const id = this.slugIndex.get(slug);
    return id ? this.tenants.get(id) ?? null : null;
  }

  async findAll(options?: { status?: TenantStatus; plan?: PlanType }): Promise<Tenant[]> {
    let results = Array.from(this.tenants.values());
    
    if (options?.status) {
      results = results.filter(t => t.status === options.status);
    }
    if (options?.plan) {
      results = results.filter(t => t.plan === options.plan);
    }
    
    return results;
  }

  async create(input: CreateTenantInput): Promise<Tenant> {
    // Check slug uniqueness
    if (this.slugIndex.has(input.slug)) {
      throw new TenantError('SLUG_EXISTS', `Tenant with slug "${input.slug}" already exists`);
    }

    const id = generateId();
    const plan = input.plan ?? 'FREE';
    const now = new Date();

    const tenant: Tenant = {
      id,
      name: input.name,
      slug: input.slug,
      plan,
      limits: { ...DEFAULT_PLAN_LIMITS[plan] },
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
      settings: input.settings,
    };

    this.tenants.set(id, tenant);
    this.slugIndex.set(input.slug, id);

    return tenant;
  }

  async update(id: string, input: UpdateTenantInput): Promise<Tenant> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      throw new TenantError('NOT_FOUND', `Tenant "${id}" not found`);
    }

    const updated: Tenant = {
      ...tenant,
      ...input,
      limits: input.limits ? { ...tenant.limits, ...input.limits } : tenant.limits,
      settings: input.settings ? { ...tenant.settings, ...input.settings } : tenant.settings,
      metadata: input.metadata ? { ...tenant.metadata, ...input.metadata } : tenant.metadata,
      updatedAt: new Date(),
    };

    // Handle plan change
    if (input.plan && input.plan !== tenant.plan) {
      updated.limits = { ...DEFAULT_PLAN_LIMITS[input.plan], ...input.limits };
    }

    this.tenants.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      throw new TenantError('NOT_FOUND', `Tenant "${id}" not found`);
    }

    this.slugIndex.delete(tenant.slug);
    this.tenants.delete(id);
  }

  async suspend(id: string, reason?: string): Promise<Tenant> {
    return this.update(id, { 
      metadata: { suspendReason: reason, suspendedAt: new Date().toISOString() } 
    }).then(t => {
      t.status = 'SUSPENDED';
      this.tenants.set(id, t);
      return t;
    });
  }

  async activate(id: string): Promise<Tenant> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      throw new TenantError('NOT_FOUND', `Tenant "${id}" not found`);
    }

    tenant.status = 'ACTIVE';
    tenant.updatedAt = new Date();
    this.tenants.set(id, tenant);
    return tenant;
  }

  // For testing
  clear(): void {
    this.tenants.clear();
    this.slugIndex.clear();
  }
}

// ============================================================================
// Tenant Manager
// ============================================================================

export class TenantManager {
  constructor(private repository: TenantRepository) {}

  async getTenant(id: string): Promise<Tenant> {
    const tenant = await this.repository.findById(id);
    if (!tenant) {
      throw new TenantError('NOT_FOUND', `Tenant "${id}" not found`);
    }
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.repository.findBySlug(slug);
    if (!tenant) {
      throw new TenantError('NOT_FOUND', `Tenant with slug "${slug}" not found`);
    }
    return tenant;
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      throw new TenantError('INVALID_SLUG', 'Slug must be lowercase alphanumeric with dashes');
    }

    // Reserved slugs
    const reserved = ['admin', 'api', 'www', 'app', 'dashboard', 'system'];
    if (reserved.includes(input.slug)) {
      throw new TenantError('RESERVED_SLUG', `Slug "${input.slug}" is reserved`);
    }

    return this.repository.create(input);
  }

  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
    return this.repository.update(id, input);
  }

  async deleteTenant(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async suspendTenant(id: string, reason?: string): Promise<Tenant> {
    return this.repository.suspend(id, reason);
  }

  async activateTenant(id: string): Promise<Tenant> {
    return this.repository.activate(id);
  }

  async upgradePlan(id: string, newPlan: PlanType): Promise<Tenant> {
    return this.repository.update(id, { plan: newPlan });
  }

  async checkLimit(tenant: Tenant, limitName: keyof TenantLimits, currentValue: number): Promise<boolean> {
    const limit = tenant.limits[limitName];
    if (typeof limit !== 'number') return true;
    if (limit === -1) return true; // Unlimited
    return currentValue < limit;
  }

  async isActive(id: string): Promise<boolean> {
    const tenant = await this.repository.findById(id);
    return tenant?.status === 'ACTIVE';
  }
}

// ============================================================================
// Errors
// ============================================================================

export type TenantErrorCode = 
  | 'NOT_FOUND'
  | 'SLUG_EXISTS'
  | 'INVALID_SLUG'
  | 'RESERVED_SLUG'
  | 'SUSPENDED'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_PLAN';

export class TenantError extends Error {
  constructor(
    public readonly code: TenantErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate tenant slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug);
}

/**
 * Generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}
