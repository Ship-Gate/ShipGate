/**
 * Tenant entity implementation
 */

import { v4 as uuidv4 } from 'uuid';
import { Tenant, TenantCreateInput, TenantUpdateInput, TenantFilter } from './types';
import { TenantStore } from './store';
import { TenantNotFoundError } from '../errors';

export class TenantService {
  constructor(private store: TenantStore) {}

  /**
   * Create a new tenant
   */
  async create(input: TenantCreateInput): Promise<Tenant> {
    const tenant: Tenant = {
      id: { value: uuidv4() },
      organizationId: input.organizationId,
      plan: input.plan,
      status: 'ACTIVE' as any,
      createdAt: { value: new Date() },
      updatedAt: { value: new Date() },
      settings: input.settings,
      metadata: input.metadata
    };

    return await this.store.save(tenant);
  }

  /**
   * Get a tenant by ID
   */
  async getById(id: string): Promise<Tenant> {
    const tenant = await this.store.findById(id);
    if (!tenant) {
      throw new TenantNotFoundError(id);
    }
    return tenant;
  }

  /**
   * Update a tenant
   */
  async update(id: string, input: TenantUpdateInput): Promise<Tenant> {
    const existing = await this.getById(id);

    const updated: Tenant = {
      ...existing,
      ...input,
      updatedAt: { value: new Date() }
    };

    return await this.store.save(updated);
  }

  /**
   * Delete a tenant
   */
  async delete(id: string): Promise<void> {
    const tenant = await this.getById(id);
    await this.store.delete(tenant.id.value);
  }

  /**
   * List tenants with filtering
   */
  async list(filter: TenantFilter = {}): Promise<Tenant[]> {
    return await this.store.findMany(filter);
  }

  /**
   * Get tenant by organization ID
   */
  async getByOrganizationId(organizationId: string): Promise<Tenant | null> {
    const tenants = await this.store.findMany({ organizationId });
    return tenants[0] || null;
  }

  /**
   * Suspend a tenant
   */
  async suspend(id: string): Promise<Tenant> {
    return await this.update(id, { status: 'SUSPENDED' as any });
  }

  /**
   * Activate a tenant
   */
  async activate(id: string): Promise<Tenant> {
    return await this.update(id, { status: 'ACTIVE' as any });
  }

  /**
   * Change tenant plan
   */
  async changePlan(id: string, plan: any): Promise<Tenant> {
    return await this.update(id, { plan });
  }
}
