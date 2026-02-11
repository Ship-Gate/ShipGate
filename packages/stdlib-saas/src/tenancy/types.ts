/**
 * Tenant-specific types
 */

import { UUID, Timestamp, SubscriptionPlan, OrganizationStatus, JSON } from '../types';

export interface Tenant {
  id: UUID;
  organizationId: UUID;
  plan: SubscriptionPlan;
  status: OrganizationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings?: JSON;
  metadata?: TenantMetadata;
}

export interface TenantMetadata {
  domain?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large';
  source?: 'signup' | 'admin' | 'migration';
  customAttributes?: Record<string, any>;
}

export interface TenantCreateInput {
  organizationId: UUID;
  plan: SubscriptionPlan;
  settings?: JSON;
  metadata?: TenantMetadata;
}

export interface TenantUpdateInput {
  plan?: SubscriptionPlan;
  status?: OrganizationStatus;
  settings?: JSON;
  metadata?: Partial<TenantMetadata>;
}

export interface TenantFilter {
  status?: OrganizationStatus;
  plan?: SubscriptionPlan;
  organizationId?: string | UUID;
  limit?: number;
  offset?: number;
}
