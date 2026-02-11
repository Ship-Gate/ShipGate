/**
 * Feature flag types
 */

import { SubscriptionPlan } from '../types';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rules: FeatureRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureRule {
  id: string;
  type: 'plan' | 'tenant' | 'percentage' | 'user' | 'global';
  value: string | number;
  enabled: boolean;
  priority: number;
}

export interface FeatureFlagCreateInput {
  key: string;
  enabled?: boolean;
  rules?: Omit<FeatureRule, 'id' | 'priority'>[];
}

export interface FeatureFlagUpdateInput {
  enabled?: boolean;
  rules?: Omit<FeatureRule, 'id' | 'priority'>[];
}

export interface FeatureEvaluationContext {
  tenantId: string;
  userId?: string;
  plan: SubscriptionPlan;
  attributes?: Record<string, any>;
}

export interface FeatureEvaluationResult {
  enabled: boolean;
  source: string;
  rule?: FeatureRule;
}
