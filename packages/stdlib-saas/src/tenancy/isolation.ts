/**
 * Data isolation enforcement for multi-tenancy
 */

import { TenantContextManager } from './context';
import { IsolationViolationError } from '../errors';

export class DataIsolation {
  /**
   * Enforce that a query is scoped to the current tenant
   */
  static enforceTenantScope(query: any, tenantIdField = 'tenant_id'): any {
    const currentTenantId = TenantContextManager.requireTenantId();
    
    if (!query.where) {
      query.where = {};
    }
    
    // Add tenant filter to query
    query.where[tenantIdField] = currentTenantId.value;
    
    return query;
  }

  /**
   * Check if a resource belongs to the current tenant
   */
  static checkOwnership(resourceTenantId: string): void {
    const currentTenantId = TenantContextManager.requireTenantId();
    
    if (resourceTenantId !== currentTenantId.value) {
      throw new IsolationViolationError(
        'access resource',
        resourceTenantId
      );
    }
  }

  /**
   * Filter an array of resources to only those belonging to the current tenant
   */
  static filterByTenant<T extends { tenant_id?: string | { value: string } }>(
    resources: T[]
  ): T[] {
    const currentTenantId = TenantContextManager.requireTenantId();
    
    return resources.filter(resource => {
      const tenantId = typeof resource.tenant_id === 'string' 
        ? resource.tenant_id 
        : resource.tenant_id?.value;
      return tenantId === currentTenantId.value;
    });
  }

  /**
   * Wrap a database operation with tenant isolation
   */
  static withIsolation<T>(
    operation: () => Promise<T>,
    options?: { tenantIdField?: string }
  ): Promise<T> {
    return TenantContextManager.run(
      TenantContextManager.current()!,
      async () => {
        // Verify context exists
        TenantContextManager.requireTenantId();
        return await operation();
      }
    );
  }

  /**
   * Create a scoped query builder
   */
  static createScopedQuery(baseQuery: any = {}, tenantIdField = 'tenant_id'): any {
    return this.enforceTenantScope({ ...baseQuery }, tenantIdField);
  }

  /**
   * Validate cross-tenant access (admin operations only)
   */
  static validateCrossTenantAccess(
    targetTenantIds: string[],
    requiredPermission: string = 'admin'
  ): void {
    const context = TenantContextManager.current();
    if (!context) {
      throw new IsolationViolationError(
        'cross-tenant access without context',
        'unknown'
      );
    }

    // In a real implementation, check if user has required permission
    // For now, we'll deny all cross-tenant access
    if (targetTenantIds.some(id => id !== context.tenantId.value)) {
      throw new IsolationViolationError(
        `cross-tenant access requires ${requiredPermission} permission`,
        targetTenantIds.find(id => id !== context.tenantId.value)!
      );
    }
  }
}
