/**
 * Tenant Context
 * 
 * AsyncLocalStorage-based tenant context for request isolation.
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { Tenant } from './tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface TenantContextData {
  tenant: Tenant;
  userId?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
  startTime: number;
}

export interface ContextOptions {
  userId?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Tenant Context
// ============================================================================

const storage = new AsyncLocalStorage<TenantContextData>();

export const TenantContext = {
  /**
   * Run a function within a tenant context
   */
  run<T>(tenant: Tenant, fn: () => T, options?: ContextOptions): T {
    const data: TenantContextData = {
      tenant,
      userId: options?.userId,
      permissions: options?.permissions,
      metadata: options?.metadata,
      startTime: Date.now(),
    };
    return storage.run(data, fn);
  },

  /**
   * Run an async function within a tenant context
   */
  async runAsync<T>(tenant: Tenant, fn: () => Promise<T>, options?: ContextOptions): Promise<T> {
    const data: TenantContextData = {
      tenant,
      userId: options?.userId,
      permissions: options?.permissions,
      metadata: options?.metadata,
      startTime: Date.now(),
    };
    return storage.run(data, fn);
  },

  /**
   * Get the current tenant context
   */
  current(): TenantContextData | undefined {
    return storage.getStore();
  },

  /**
   * Get the current tenant (throws if not in context)
   */
  getTenant(): Tenant {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new NoTenantContextError();
    }
    return ctx.tenant;
  },

  /**
   * Get the current tenant ID (throws if not in context)
   */
  getTenantId(): string {
    return this.getTenant().id;
  },

  /**
   * Check if we're in a tenant context
   */
  isInContext(): boolean {
    return storage.getStore() !== undefined;
  },

  /**
   * Get tenant or undefined (doesn't throw)
   */
  tryGetTenant(): Tenant | undefined {
    return storage.getStore()?.tenant;
  },

  /**
   * Get context metadata
   */
  getMetadata(): Record<string, unknown> {
    return storage.getStore()?.metadata ?? {};
  },

  /**
   * Get user ID from context
   */
  getUserId(): string | undefined {
    return storage.getStore()?.userId;
  },

  /**
   * Get permissions from context
   */
  getPermissions(): string[] {
    return storage.getStore()?.permissions ?? [];
  },

  /**
   * Check if user has a permission
   */
  hasPermission(permission: string): boolean {
    const permissions = this.getPermissions();
    return permissions.includes(permission) || permissions.includes('*');
  },

  /**
   * Get elapsed time in current context
   */
  getElapsedMs(): number {
    const ctx = storage.getStore();
    return ctx ? Date.now() - ctx.startTime : 0;
  },

  /**
   * Create a child context with additional metadata
   */
  withMetadata<T>(metadata: Record<string, unknown>, fn: () => T): T {
    const current = storage.getStore();
    if (!current) {
      throw new NoTenantContextError();
    }

    const newData: TenantContextData = {
      ...current,
      metadata: { ...current.metadata, ...metadata },
    };

    return storage.run(newData, fn);
  },

  /**
   * Create a context with impersonated user
   */
  asUser<T>(userId: string, permissions: string[], fn: () => T): T {
    const current = storage.getStore();
    if (!current) {
      throw new NoTenantContextError();
    }

    const newData: TenantContextData = {
      ...current,
      userId,
      permissions,
      metadata: { ...current.metadata, impersonatedBy: current.userId },
    };

    return storage.run(newData, fn);
  },
};

// ============================================================================
// Errors
// ============================================================================

export class NoTenantContextError extends Error {
  constructor() {
    super('No tenant context available. Ensure request is within TenantContext.run()');
    this.name = 'NoTenantContextError';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Decorator to require tenant context
 */
export function requireTenantContext<T extends (...args: unknown[]) => unknown>(
  _target: object,
  _propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> {
  const originalMethod = descriptor.value!;

  descriptor.value = function (this: unknown, ...args: unknown[]) {
    if (!TenantContext.isInContext()) {
      throw new NoTenantContextError();
    }
    return originalMethod.apply(this, args);
  } as T;

  return descriptor;
}

/**
 * Higher-order function to wrap a function with tenant context requirement
 */
export function withTenantContext<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return ((...args: unknown[]) => {
    if (!TenantContext.isInContext()) {
      throw new NoTenantContextError();
    }
    return fn(...args);
  }) as T;
}

/**
 * Execute a function with a specific tenant
 */
export async function withTenant<T>(
  tenant: Tenant,
  fn: () => T | Promise<T>,
  options?: ContextOptions
): Promise<T> {
  return TenantContext.runAsync(tenant, async () => fn(), options);
}

/**
 * Get tenant-scoped data key
 */
export function tenantKey(key: string): string {
  const tenantId = TenantContext.tryGetTenant()?.id;
  return tenantId ? `tenant:${tenantId}:${key}` : key;
}
