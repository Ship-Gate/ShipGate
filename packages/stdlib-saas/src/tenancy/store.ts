/**
 * Tenant storage interface and in-memory implementation
 */

import { Tenant, TenantCreateInput, TenantUpdateInput, TenantFilter } from './types';

export interface TenantStore {
  save(tenant: Tenant): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findMany(filter: TenantFilter): Promise<Tenant[]>;
  delete(id: string): Promise<void>;
  update(id: string, input: TenantUpdateInput): Promise<Tenant>;
}

export class InMemoryTenantStore implements TenantStore {
  private tenants: Map<string, Tenant> = new Map();

  async save(tenant: Tenant): Promise<Tenant> {
    this.tenants.set(tenant.id.value, tenant);
    return tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }

  async findMany(filter: TenantFilter = {}): Promise<Tenant[]> {
    let tenants = Array.from(this.tenants.values());

    if (filter.status) {
      tenants = tenants.filter(t => t.status === filter.status);
    }

    if (filter.plan) {
      tenants = tenants.filter(t => t.plan === filter.plan);
    }

    if (filter.organizationId) {
      tenants = tenants.filter(t => {
        if (typeof filter.organizationId === 'string') {
          return t.organizationId.value === filter.organizationId;
        }
        return t.organizationId.value === filter.organizationId.value;
      });
    }

    if (filter.offset) {
      tenants = tenants.slice(filter.offset);
    }

    if (filter.limit) {
      tenants = tenants.slice(0, filter.limit);
    }

    return tenants;
  }

  async delete(id: string): Promise<void> {
    this.tenants.delete(id);
  }

  async update(id: string, input: TenantUpdateInput): Promise<Tenant> {
    const existing = this.tenants.get(id);
    if (!existing) {
      throw new Error(`Tenant not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: { value: new Date() }
    };

    this.tenants.set(id, updated);
    return updated;
  }
}
