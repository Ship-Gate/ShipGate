/**
 * Plan entitlements enforcement
 */

import { SubscriptionPlan } from '../types';
import { PlanLimits, PlanDefinition, TenantPlanAssignment } from './types';
import { PlanLimitExceededError, EntitlementError } from '../errors';

export class PlanEntitlements {
  private static planDefinitions: Map<SubscriptionPlan, PlanDefinition> = new Map();

  /**
   * Register a plan definition
   */
  static registerPlan(definition: PlanDefinition): void {
    if (definition.immutable && this.planDefinitions.has(definition.plan)) {
      throw new Error(`Cannot modify immutable plan: ${definition.plan}`);
    }
    this.planDefinitions.set(definition.plan, definition);
  }

  /**
   * Get plan definition
   */
  static getPlan(plan: SubscriptionPlan): PlanDefinition | undefined {
    return this.planDefinitions.get(plan);
  }

  /**
   * Check if a tenant's plan includes a feature
   */
  static hasFeature(
    assignment: TenantPlanAssignment,
    feature: string
  ): boolean {
    const plan = this.getPlan(assignment.plan);
    if (!plan) {
      throw new EntitlementError(feature, assignment.plan);
    }

    // Check if the plan version matches
    if (plan.version !== assignment.version) {
      // In a real implementation, you might want to handle version mismatches
      // For now, we'll use the latest definition
    }

    return plan.features.includes(feature);
  }

  /**
   * Enforce a plan limit
   */
  static enforceLimit(
    assignment: TenantPlanAssignment,
    limitKey: string,
    currentValue: number
  ): void {
    const plan = this.getPlan(assignment.plan);
    if (!plan) {
      throw new EntitlementError(limitKey, assignment.plan);
    }

    const limit = plan.limits[limitKey];
    if (limit !== undefined && currentValue > limit) {
      throw new PlanLimitExceededError(limitKey, currentValue, limit);
    }
  }

  /**
   * Get all limits for a plan
   */
  static getLimits(plan: SubscriptionPlan): PlanLimits {
    const definition = this.getPlan(plan);
    if (!definition) {
      throw new Error(`Plan not found: ${plan}`);
    }
    return definition.limits;
  }

  /**
   * Get all features for a plan
   */
  static getFeatures(plan: SubscriptionPlan): string[] {
    const definition = this.getPlan(plan);
    if (!definition) {
      throw new Error(`Plan not found: ${plan}`);
    }
    return definition.features;
  }

  /**
   * Check if a plan upgrade is valid
   */
  static canUpgrade(
    currentPlan: SubscriptionPlan,
    targetPlan: SubscriptionPlan
  ): boolean {
    const current = this.getPlan(currentPlan);
    const target = this.getPlan(targetPlan);

    if (!current || !target) {
      return false;
    }

    // Simple hierarchy check - in a real implementation, this might be more complex
    const planOrder = [
      SubscriptionPlan.FREE,
      SubscriptionPlan.STARTER,
      SubscriptionPlan.PROFESSIONAL,
      SubscriptionPlan.ENTERPRISE
    ];

    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(targetPlan);

    return targetIndex > currentIndex;
  }

  /**
   * Calculate usage percentage for a limit
   */
  static getUsagePercentage(
    assignment: TenantPlanAssignment,
    limitKey: string,
    currentValue: number
  ): number {
    const plan = this.getPlan(assignment.plan);
    if (!plan) {
      throw new EntitlementError(limitKey, assignment.plan);
    }

    const limit = plan.limits[limitKey];
    if (limit === undefined || limit === 0) {
      return 0;
    }

    return Math.min((currentValue / limit) * 100, 100);
  }

  /**
   * Initialize default plans
   */
  static initializeDefaults(): void {
    // Check if plans are already initialized
    if (this.planDefinitions.has(SubscriptionPlan.FREE)) {
      return;
    }
    // Free plan
    this.registerPlan({
      plan: SubscriptionPlan.FREE,
      version: '1.0.0',
      limits: {
        maxProjects: 3,
        maxTeamMembers: 2,
        maxApiCalls: 1000,
        maxStorage: 1024 * 1024 * 100 // 100MB
      },
      features: [
        'basic_projects',
        'basic_team',
        'community_support'
      ],
      metadata: {
        displayName: 'Free',
        description: 'Perfect for getting started',
        price: 0,
        features: [
          { name: 'Projects', description: 'Up to 3 projects', included: true },
          { name: 'Team Members', description: 'Up to 2 team members', included: true },
          { name: 'API Calls', description: '1,000 calls per month', included: true },
          { name: 'Storage', description: '100 MB storage', included: true }
        ]
      },
      createdAt: new Date(),
      immutable: true
    });

    // Starter plan
    this.registerPlan({
      plan: SubscriptionPlan.STARTER,
      version: '1.0.0',
      limits: {
        maxProjects: 10,
        maxTeamMembers: 5,
        maxApiCalls: 10000,
        maxStorage: 1024 * 1024 * 1024 // 1GB
      },
      features: [
        'basic_projects',
        'basic_team',
        'advanced_projects',
        'email_support',
        'analytics'
      ],
      metadata: {
        displayName: 'Starter',
        description: 'For small teams and growing businesses',
        price: 29,
        currency: 'USD',
        billingInterval: 'monthly',
        features: [
          { name: 'Projects', description: 'Up to 10 projects', included: true },
          { name: 'Team Members', description: 'Up to 5 team members', included: true },
          { name: 'API Calls', description: '10,000 calls per month', included: true },
          { name: 'Storage', description: '1 GB storage', included: true },
          { name: 'Analytics', description: 'Basic analytics dashboard', included: true }
        ]
      },
      createdAt: new Date(),
      immutable: true
    });

    // Professional plan
    this.registerPlan({
      plan: SubscriptionPlan.PROFESSIONAL,
      version: '1.0.0',
      limits: {
        maxProjects: 50,
        maxTeamMembers: 20,
        maxApiCalls: 100000,
        maxStorage: 1024 * 1024 * 1024 * 10 // 10GB
      },
      features: [
        'basic_projects',
        'basic_team',
        'advanced_projects',
        'email_support',
        'priority_support',
        'analytics',
        'advanced_analytics',
        'integrations',
        'custom_domains'
      ],
      metadata: {
        displayName: 'Professional',
        description: 'For professional teams and agencies',
        price: 99,
        currency: 'USD',
        billingInterval: 'monthly',
        features: [
          { name: 'Projects', description: 'Up to 50 projects', included: true },
          { name: 'Team Members', description: 'Up to 20 team members', included: true },
          { name: 'API Calls', description: '100,000 calls per month', included: true },
          { name: 'Storage', description: '10 GB storage', included: true },
          { name: 'Priority Support', description: '24-hour response time', included: true },
          { name: 'Custom Domains', description: 'Use your own domain', included: true }
        ]
      },
      createdAt: new Date(),
      immutable: true
    });

    // Enterprise plan
    this.registerPlan({
      plan: SubscriptionPlan.ENTERPRISE,
      version: '1.0.0',
      limits: {
        maxProjects: -1, // Unlimited
        maxTeamMembers: -1, // Unlimited
        maxApiCalls: -1, // Unlimited
        maxStorage: -1 // Unlimited
      },
      features: [
        'basic_projects',
        'basic_team',
        'advanced_projects',
        'email_support',
        'priority_support',
        'dedicated_support',
        'analytics',
        'advanced_analytics',
        'integrations',
        'custom_domains',
        'sso',
        'audit_logs',
        'custom_integrations',
        'sla'
      ],
      metadata: {
        displayName: 'Enterprise',
        description: 'Custom solutions for large organizations',
        price: 299,
        currency: 'USD',
        billingInterval: 'monthly',
        features: [
          { name: 'Projects', description: 'Unlimited projects', included: true },
          { name: 'Team Members', description: 'Unlimited team members', included: true },
          { name: 'API Calls', description: 'Unlimited API calls', included: true },
          { name: 'Storage', description: 'Unlimited storage', included: true },
          { name: 'Dedicated Support', description: 'Dedicated success manager', included: true },
          { name: 'SSO', description: 'Single sign-on (SAML)', included: true },
          { name: 'Audit Logs', description: 'Comprehensive audit logging', included: true },
          { name: 'SLA', description: '99.9% uptime guarantee', included: true }
        ]
      },
      createdAt: new Date(),
      immutable: true
    });
  }
}
