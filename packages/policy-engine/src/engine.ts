/**
 * Policy Engine - Evaluate policies against ISL behaviors
 */
import type {
  Policy,
  PolicyRule,
  PolicyCondition,
  PolicyContext,
  PolicyDecision,
  PolicyEvaluationResult,
  PolicySet,
  CombiningAlgorithm,
  PolicyAuditLog,
  PolicyStats,
  PolicyObligation,
} from './types';

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private policySets: Map<string, PolicySet> = new Map();
  private auditLog: PolicyAuditLog[] = [];
  private stats: PolicyStats = {
    totalEvaluations: 0,
    allowedCount: 0,
    deniedCount: 0,
    averageEvaluationTime: 0,
    policyHits: {},
  };
  private customFunctions: Map<string, (args: unknown[], context: PolicyContext) => boolean> = new Map();

  /**
   * Register a policy
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.stats.policyHits[policy.id] = 0;
  }

  /**
   * Register multiple policies
   */
  registerPolicies(policies: Policy[]): void {
    for (const policy of policies) {
      this.registerPolicy(policy);
    }
  }

  /**
   * Register a policy set
   */
  registerPolicySet(policySet: PolicySet): void {
    this.policySets.set(policySet.id, policySet);
    for (const policy of policySet.policies) {
      this.registerPolicy(policy);
    }
  }

  /**
   * Register a custom function for use in conditions
   */
  registerFunction(
    name: string,
    fn: (args: unknown[], context: PolicyContext) => boolean
  ): void {
    this.customFunctions.set(name, fn);
  }

  /**
   * Evaluate policies for a given context
   */
  evaluate(context: PolicyContext): PolicyEvaluationResult {
    const startTime = Date.now();
    const decisions: PolicyDecision[] = [];
    const matchedPolicies: string[] = [];

    // Get applicable policies
    const applicablePolicies = this.getApplicablePolicies(context);

    // Sort by priority
    const sortedPolicies = [...applicablePolicies].sort(
      (a, b) => b.priority - a.priority
    );

    for (const policy of sortedPolicies) {
      if (!policy.enabled || policy.enforcement === 'DISABLED') {
        continue;
      }

      const decision = this.evaluatePolicy(policy, context);
      if (decision) {
        decisions.push(decision);
        matchedPolicies.push(policy.id);
        this.stats.policyHits[policy.id]++;

        // Stop on first deny for enforcing policies
        if (decision.effect === 'DENY' && policy.enforcement === 'ENFORCING') {
          break;
        }
      }
    }

    // Determine final decision
    const allowed = this.combineDecisions(decisions, 'DENY_OVERRIDES');
    const evaluationTime = Date.now() - startTime;

    // Update stats
    this.updateStats(allowed, evaluationTime);

    const result: PolicyEvaluationResult = {
      allowed,
      decisions,
      matchedPolicies,
      evaluationTime,
      context,
    };

    // Log audit
    this.logAudit(context, result, evaluationTime);

    return result;
  }

  /**
   * Evaluate a policy set
   */
  evaluatePolicySet(policySetId: string, context: PolicyContext): PolicyEvaluationResult {
    const policySet = this.policySets.get(policySetId);
    if (!policySet) {
      throw new Error(`Policy set '${policySetId}' not found`);
    }

    const startTime = Date.now();
    const decisions: PolicyDecision[] = [];
    const matchedPolicies: string[] = [];

    for (const policy of policySet.policies) {
      if (!policy.enabled) continue;

      const decision = this.evaluatePolicy(policy, context);
      if (decision) {
        decisions.push(decision);
        matchedPolicies.push(policy.id);
      }
    }

    const allowed = this.combineDecisions(decisions, policySet.combiningAlgorithm);
    const evaluationTime = Date.now() - startTime;

    this.updateStats(allowed, evaluationTime);

    return {
      allowed,
      decisions,
      matchedPolicies,
      evaluationTime,
      context,
    };
  }

  /**
   * Check if an action is allowed (simple boolean check)
   */
  isAllowed(context: PolicyContext): boolean {
    return this.evaluate(context).allowed;
  }

  /**
   * Get all obligations for allowed actions
   */
  getObligations(context: PolicyContext): PolicyObligation[] {
    const result = this.evaluate(context);
    if (!result.allowed) return [];

    return result.decisions
      .filter(d => d.effect === 'ALLOW' && d.obligations)
      .flatMap(d => d.obligations ?? []);
  }

  /**
   * Get statistics
   */
  getStats(): PolicyStats {
    return { ...this.stats };
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): PolicyAuditLog[] {
    const log = [...this.auditLog].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
    delete this.stats.policyHits[policyId];
  }

  /**
   * Get all registered policies
   */
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  // Private methods

  private getApplicablePolicies(context: PolicyContext): Policy[] {
    return Array.from(this.policies.values()).filter(policy => {
      return this.isPolicyApplicable(policy, context);
    });
  }

  private isPolicyApplicable(policy: Policy, context: PolicyContext): boolean {
    const scope = policy.scope;

    // Check domain scope
    if (scope.domains && scope.domains.length > 0) {
      if (!context.action?.domain || !scope.domains.includes(context.action.domain)) {
        return false;
      }
    }

    // Check behavior scope
    if (scope.behaviors && scope.behaviors.length > 0) {
      if (!context.action?.name || !scope.behaviors.includes(context.action.name)) {
        return false;
      }
    }

    // Check entity scope
    if (scope.entities && scope.entities.length > 0) {
      if (!context.resource?.type || !scope.entities.includes(context.resource.type)) {
        return false;
      }
    }

    // Check principal scope
    if (scope.principals && scope.principals.length > 0) {
      if (!context.principal?.type || !scope.principals.includes(context.principal.type)) {
        return false;
      }
    }

    // Check environment scope
    if (scope.environments && scope.environments.length > 0) {
      if (!context.environment?.name || !scope.environments.includes(context.environment.name)) {
        return false;
      }
    }

    return true;
  }

  private evaluatePolicy(policy: Policy, context: PolicyContext): PolicyDecision | null {
    for (const rule of policy.rules) {
      const matches = this.evaluateCondition(rule.condition, context);
      if (matches) {
        return {
          effect: rule.effect,
          policy: policy.id,
          rule: rule.id,
          reason: rule.description,
          obligations: rule.obligations,
          context: {
            policyName: policy.name,
            ruleName: rule.name,
          },
        };
      }
    }
    return null;
  }

  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    switch (condition.type) {
      case 'attribute':
        return this.evaluateAttributeCondition(condition, context);

      case 'function':
        return this.evaluateFunctionCondition(condition, context);

      case 'and':
        return condition.children?.every(c => this.evaluateCondition(c, context)) ?? true;

      case 'or':
        return condition.children?.some(c => this.evaluateCondition(c, context)) ?? false;

      case 'not':
        return condition.children
          ? !this.evaluateCondition(condition.children[0], context)
          : true;

      case 'all':
        return condition.children?.every(c => this.evaluateCondition(c, context)) ?? true;

      case 'any':
        return condition.children?.some(c => this.evaluateCondition(c, context)) ?? false;

      case 'none':
        return condition.children?.every(c => !this.evaluateCondition(c, context)) ?? true;

      default:
        return false;
    }
  }

  private evaluateAttributeCondition(
    condition: PolicyCondition,
    context: PolicyContext
  ): boolean {
    if (!condition.attribute || !condition.operator) return false;

    const value = this.getAttributeValue(condition.attribute, context);
    const target = condition.value;

    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'notEquals':
        return value !== target;
      case 'contains':
        return typeof value === 'string' && value.includes(String(target));
      case 'notContains':
        return typeof value === 'string' && !value.includes(String(target));
      case 'matches':
        return typeof value === 'string' && new RegExp(String(target)).test(value);
      case 'in':
        return Array.isArray(target) && target.includes(value);
      case 'notIn':
        return Array.isArray(target) && !target.includes(value);
      case 'greaterThan':
        return typeof value === 'number' && typeof target === 'number' && value > target;
      case 'lessThan':
        return typeof value === 'number' && typeof target === 'number' && value < target;
      case 'between':
        return typeof value === 'number' &&
          Array.isArray(target) &&
          target.length === 2 &&
          value >= (target[0] as number) &&
          value <= (target[1] as number);
      case 'exists':
        return value !== undefined && value !== null;
      case 'notExists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  private evaluateFunctionCondition(
    condition: PolicyCondition,
    context: PolicyContext
  ): boolean {
    if (!condition.function) return false;

    const fn = this.customFunctions.get(condition.function);
    if (!fn) {
      return false;
    }

    return fn(condition.args ?? [], context);
  }

  private getAttributeValue(path: string, context: PolicyContext): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private combineDecisions(
    decisions: PolicyDecision[],
    algorithm: CombiningAlgorithm
  ): boolean {
    if (decisions.length === 0) return true; // Default allow

    switch (algorithm) {
      case 'DENY_OVERRIDES':
        return !decisions.some(d => d.effect === 'DENY');

      case 'PERMIT_OVERRIDES':
        return decisions.some(d => d.effect === 'ALLOW');

      case 'FIRST_APPLICABLE':
        const first = decisions[0];
        return first?.effect === 'ALLOW';

      case 'ONLY_ONE_APPLICABLE':
        const allows = decisions.filter(d => d.effect === 'ALLOW');
        return allows.length === 1;

      default:
        return !decisions.some(d => d.effect === 'DENY');
    }
  }

  private updateStats(allowed: boolean, evaluationTime: number): void {
    this.stats.totalEvaluations++;
    if (allowed) {
      this.stats.allowedCount++;
    } else {
      this.stats.deniedCount++;
    }
    this.stats.averageEvaluationTime =
      (this.stats.averageEvaluationTime * (this.stats.totalEvaluations - 1) + evaluationTime) /
      this.stats.totalEvaluations;
  }

  private logAudit(
    context: PolicyContext,
    result: PolicyEvaluationResult,
    duration: number
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      context,
      result,
      duration,
    });

    // Keep only last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }
}
