/**
 * Plan storage interface and in-memory implementation
 */

import { PlanDefinition, TenantPlanAssignment, PlanUpgradeRequest, PlanUsage } from './types';

export interface PlanStore {
  // Plan definitions
  savePlan(plan: PlanDefinition): Promise<PlanDefinition>;
  findPlan(plan: string): Promise<PlanDefinition | null>;
  findAllPlans(): Promise<PlanDefinition[]>;
  
  // Tenant assignments
  saveAssignment(assignment: TenantPlanAssignment): Promise<TenantPlanAssignment>;
  findAssignmentByTenant(tenantId: string): Promise<TenantPlanAssignment | null>;
  findAllAssignments(): Promise<TenantPlanAssignment[]>;
  
  // Upgrade requests
  saveUpgradeRequest(request: PlanUpgradeRequest & { id: string; status: string; createdAt: Date }): Promise<void>;
  findUpgradeRequests(tenantId: string): Promise<PlanUpgradeRequest[]>;
  
  // Usage tracking
  saveUsage(usage: PlanUsage): Promise<PlanUsage>;
  findCurrentUsage(tenantId: string): Promise<PlanUsage | null>;
  findUsageHistory(tenantId: string, limit?: number): Promise<PlanUsage[]>;
}

export class InMemoryPlanStore implements PlanStore {
  private plans: Map<string, PlanDefinition> = new Map();
  private assignments: Map<string, TenantPlanAssignment> = new Map();
  private upgradeRequests: Map<string, Array<PlanUpgradeRequest & { id: string; status: string; createdAt: Date }>> = new Map();
  private usage: Map<string, PlanUsage[]> = new Map();

  // Plan definitions
  async savePlan(plan: PlanDefinition): Promise<PlanDefinition> {
    this.plans.set(plan.plan, plan);
    return plan;
  }

  async findPlan(plan: string): Promise<PlanDefinition | null> {
    return this.plans.get(plan) || null;
  }

  async findAllPlans(): Promise<PlanDefinition[]> {
    return Array.from(this.plans.values());
  }

  // Tenant assignments
  async saveAssignment(assignment: TenantPlanAssignment): Promise<TenantPlanAssignment> {
    this.assignments.set(assignment.tenantId, assignment);
    return assignment;
  }

  async findAssignmentByTenant(tenantId: string): Promise<TenantPlanAssignment | null> {
    return this.assignments.get(tenantId) || null;
  }

  async findAllAssignments(): Promise<TenantPlanAssignment[]> {
    return Array.from(this.assignments.values());
  }

  // Upgrade requests
  async saveUpgradeRequest(request: PlanUpgradeRequest & { id: string; status: string; createdAt: Date }): Promise<void> {
    const existing = this.upgradeRequests.get(request.tenantId) || [];
    existing.push(request);
    this.upgradeRequests.set(request.tenantId, existing);
  }

  async findUpgradeRequests(tenantId: string): Promise<PlanUpgradeRequest[]> {
    const requests = this.upgradeRequests.get(tenantId) || [];
    return requests.map(({ id, status, createdAt, ...rest }) => rest);
  }

  // Usage tracking
  async saveUsage(usage: PlanUsage): Promise<PlanUsage> {
    const existing = this.usage.get(usage.tenantId) || [];
    
    // Remove any existing usage for the same period
    const filtered = existing.filter(u => 
      u.period.start.getTime() !== usage.period.start.getTime() ||
      u.period.end.getTime() !== usage.period.end.getTime()
    );
    
    filtered.push(usage);
    this.usage.set(usage.tenantId, filtered);
    
    return usage;
  }

  async findCurrentUsage(tenantId: string): Promise<PlanUsage | null> {
    const usage = this.usage.get(tenantId) || [];
    const now = new Date();
    
    // Find the usage record for the current period
    return usage.find(u => 
      u.period.start <= now && u.period.end >= now
    ) || null;
  }

  async findUsageHistory(tenantId: string, limit: number = 10): Promise<PlanUsage[]> {
    const usage = this.usage.get(tenantId) || [];
    return usage
      .sort((a, b) => b.period.start.getTime() - a.period.start.getTime())
      .slice(0, limit);
  }
}
