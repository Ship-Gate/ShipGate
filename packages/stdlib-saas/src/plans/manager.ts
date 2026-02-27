/**
 * Plan management service
 */

import { v4 as uuidv4 } from 'uuid';
import { SubscriptionPlan } from '../types';
import { 
  PlanDefinition, 
  TenantPlanAssignment, 
  PlanUpgradeRequest,
  PlanUsage 
} from './types';
import { PlanEntitlements } from './entitlements';
import { PlanStore } from './store';

export class PlanManager {
  constructor(private store: PlanStore) {
    // Initialize default plans if not already done
    PlanEntitlements.initializeDefaults();
  }

  /**
   * Assign a plan to a tenant
   */
  async assignPlan(
    tenantId: string,
    plan: SubscriptionPlan,
    assignedBy: string,
    options?: { version?: string; lockedUntil?: Date }
  ): Promise<TenantPlanAssignment> {
    const planDefinition = PlanEntitlements.getPlan(plan);
    if (!planDefinition) {
      throw new Error(`Plan not found: ${plan}`);
    }

    const assignment: TenantPlanAssignment = {
      tenantId,
      plan,
      version: options?.version || planDefinition.version,
      assignedAt: new Date(),
      assignedBy,
      lockedUntil: options?.lockedUntil
    };

    return await this.store.saveAssignment(assignment);
  }

  /**
   * Get a tenant's current plan assignment
   */
  async getTenantPlan(tenantId: string): Promise<TenantPlanAssignment | null> {
    return await this.store.findAssignmentByTenant(tenantId);
  }

  /**
   * Change a tenant's plan
   */
  async changePlan(
    tenantId: string,
    targetPlan: SubscriptionPlan,
    requestedBy: string,
    effectiveAt: Date = new Date()
  ): Promise<TenantPlanAssignment> {
    const current = await this.getTenantPlan(tenantId);
    if (!current) {
      throw new Error(`No plan assigned to tenant: ${tenantId}`);
    }

    // Check if this is a valid upgrade/downgrade
    if (!PlanEntitlements.canUpgrade(current.plan, targetPlan) && 
        current.plan !== targetPlan) {
      // Allow downgrades but log them
      console.warn(`Downgrading tenant ${tenantId} from ${current.plan} to ${targetPlan}`);
    }

    // Create the new assignment
    const assignment = await this.assignPlan(tenantId, targetPlan, requestedBy);

    // If effective date is in the future, schedule the change
    if (effectiveAt > new Date()) {
      // In a real implementation, you would use a job scheduler
      console.log(`Scheduling plan change for tenant ${tenantId} effective ${effectiveAt}`);
    }

    return assignment;
  }

  /**
   * Request a plan upgrade
   */
  async requestUpgrade(request: PlanUpgradeRequest): Promise<void> {
    const current = await this.getTenantPlan(request.tenantId);
    if (!current) {
      throw new Error(`No plan assigned to tenant: ${request.tenantId}`);
    }

    if (!PlanEntitlements.canUpgrade(current.plan, request.targetPlan)) {
      throw new Error(`Invalid upgrade from ${current.plan} to ${request.targetPlan}`);
    }

    await this.store.saveUpgradeRequest({
      ...request,
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date()
    });
  }

  /**
   * Get all plan definitions
   */
  async getAvailablePlans(): Promise<PlanDefinition[]> {
    const plans: PlanDefinition[] = [];
    for (const plan of Object.values(SubscriptionPlan)) {
      const definition = PlanEntitlements.getPlan(plan as SubscriptionPlan);
      if (definition) {
        plans.push(definition);
      }
    }
    return plans;
  }

  /**
   * Track usage against plan limits
   */
  async trackUsage(
    tenantId: string,
    usage: Record<string, number>,
    period?: { start: Date; end: Date }
  ): Promise<void> {
    const assignment = await this.getTenantPlan(tenantId);
    if (!assignment) {
      throw new Error(`No plan assigned to tenant: ${tenantId}`);
    }

    const limits = PlanEntitlements.getLimits(assignment.plan);

    // Check each usage metric against limits
    for (const [key, value] of Object.entries(usage)) {
      const limit = limits[key];
      if (limit !== undefined && limit > 0) {
        PlanEntitlements.enforceLimit(assignment, key, value);
      }
    }

    // Save the usage record
    await this.store.saveUsage({
      tenantId,
      period: period || {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      },
      usage,
      limits
    });
  }

  /**
   * Get current usage for a tenant
   */
  async getCurrentUsage(tenantId: string): Promise<PlanUsage | null> {
    return await this.store.findCurrentUsage(tenantId);
  }

  /**
   * Get usage percentage for all limits
   */
  async getUsagePercentages(tenantId: string): Promise<Record<string, number>> {
    const assignment = await this.getTenantPlan(tenantId);
    if (!assignment) {
      throw new Error(`No plan assigned to tenant: ${tenantId}`);
    }

    const currentUsage = await this.getCurrentUsage(tenantId);
    if (!currentUsage) {
      return {};
    }

    const percentages: Record<string, number> = {};
    for (const [key, value] of Object.entries(currentUsage.usage)) {
      percentages[key] = PlanEntitlements.getUsagePercentage(
        assignment,
        key,
        value
      );
    }

    return percentages;
  }

  /**
   * Check if tenant can perform an action based on plan limits
   */
  async canPerformAction(
    tenantId: string,
    action: string,
    count: number = 1
  ): Promise<boolean> {
    const assignment = await this.getTenantPlan(tenantId);
    if (!assignment) {
      return false;
    }

    const currentUsage = await this.getCurrentUsage(tenantId);
    const currentCount = currentUsage?.usage[action] || 0;
    
    try {
      PlanEntitlements.enforceLimit(assignment, action, currentCount + count);
      return true;
    } catch (error) {
      if (error instanceof PlanLimitExceededError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get upgrade path for a tenant
   */
  async getUpgradePath(tenantId: string): Promise<SubscriptionPlan[]> {
    const current = await this.getTenantPlan(tenantId);
    if (!current) {
      return [];
    }

    const plans = await this.getAvailablePlans();
    return plans
      .map(p => p.plan)
      .filter(plan => PlanEntitlements.canUpgrade(current.plan, plan));
  }
}
