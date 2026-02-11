/**
 * Tenant context management with AsyncLocalStorage
 */

import { UUID, SubscriptionPlan, TenantContext } from '../types';
import { ContextPropagationError } from '../errors';

// AsyncLocalStorage polyfill check
let AsyncLocalStorage: any;
try {
  AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage;
} catch {
  // Fallback implementation for environments without AsyncLocalStorage
  AsyncLocalStorage = class AsyncLocalStorage<T> {
    private store: T | undefined;

    run(store: T, callback: (...args: any[]) => any, ...args: any[]): any {
      const oldStore = this.store;
      this.store = store;
      try {
        return callback(...args);
      } finally {
        this.store = oldStore;
      }
    }

    getStore(): T | undefined {
      return this.store;
    }
  };
}

const tenantContextALS = new AsyncLocalStorage<TenantContext>();

export class TenantContextManager {
  /**
   * Run a function within a tenant context
   */
  static run<T>(
    context: TenantContext,
    callback: () => T
  ): T {
    return tenantContextALS.run(context, callback);
  }

  /**
   * Get the current tenant context
   */
  static current(): TenantContext | undefined {
    const context = tenantContextALS.getStore();
    return context;
  }

  /**
   * Get the current tenant ID or throw if not in context
   */
  static requireTenantId(): UUID {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    return context.tenantId;
  }

  /**
   * Get the current user ID or throw if not in context
   */
  static requireUserId(): UUID {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    return context.userId;
  }

  /**
   * Check if the current tenant has a specific feature
   */
  static hasFeature(feature: string): boolean {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    return context.features.has(feature);
  }

  /**
   * Get the current tenant's plan
   */
  static currentPlan(): SubscriptionPlan {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    return context.plan;
  }

  /**
   * Create a new tenant context
   */
  static createContext(params: {
    tenantId: UUID;
    userId: UUID;
    plan: SubscriptionPlan;
    features: string[];
  }): TenantContext {
    return {
      tenantId: params.tenantId,
      userId: params.userId,
      plan: params.plan,
      features: new Set(params.features)
    };
  }

  /**
   * Add features to the current context
   */
  static addFeatures(features: string[]): void {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    features.forEach(feature => context.features.add(feature));
  }

  /**
   * Remove features from the current context
   */
  static removeFeatures(features: string[]): void {
    const context = this.current();
    if (!context) {
      throw new ContextPropagationError(
        'No tenant context available - operation must be run within a tenant context'
      );
    }
    features.forEach(feature => context.features.delete(feature));
  }
}
