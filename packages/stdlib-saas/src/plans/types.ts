/**
 * Plan management types
 */

import { SubscriptionPlan } from '../types';

export interface PlanDefinition {
  plan: SubscriptionPlan;
  version: string;
  limits: PlanLimits;
  features: string[];
  metadata?: PlanMetadata;
  createdAt: Date;
  immutable: boolean;
}

export interface PlanLimits {
  maxProjects: number;
  maxTeamMembers: number;
  maxApiCalls?: number;
  maxStorage?: number;
  [key: string]: number | undefined;
}

export interface PlanMetadata {
  displayName: string;
  description: string;
  price?: number;
  currency?: string;
  billingInterval?: 'monthly' | 'yearly';
  trialDays?: number;
  features?: FeatureDescription[];
}

export interface FeatureDescription {
  name: string;
  description: string;
  included: boolean;
}

export interface TenantPlanAssignment {
  tenantId: string;
  plan: SubscriptionPlan;
  version: string;
  assignedAt: Date;
  assignedBy: string;
  lockedUntil?: Date;
  metadata?: Record<string, any>;
}

export interface PlanUpgradeRequest {
  tenantId: string;
  targetPlan: SubscriptionPlan;
  effectiveAt?: Date;
  requestedBy: string;
  reason?: string;
}

export interface PlanUsage {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  usage: Record<string, number>;
  limits: Record<string, number>;
}
