/**
 * Policy Engine
 * 
 * Evaluate access policies based on ISL security requirements.
 */

export interface Policy {
  /** Policy name */
  name: string;
  /** Policy description */
  description?: string;
  /** Priority (higher = evaluated first) */
  priority?: number;
  /** Conditions that must be true */
  conditions: PolicyCondition[];
  /** Effect when conditions match */
  effect: 'allow' | 'deny';
  /** Domains this policy applies to */
  domains?: string[];
  /** Behaviors this policy applies to */
  behaviors?: string[];
}

export interface PolicyCondition {
  /** Condition type */
  type: 'role' | 'scope' | 'claim' | 'ip' | 'time' | 'rate' | 'custom';
  /** Operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte';
  /** Field to check (for claims) */
  field?: string;
  /** Expected value(s) */
  value: unknown;
}

export interface PolicyContext {
  /** The request */
  request: {
    headers: Record<string, string>;
    clientIp: string;
    timestamp: Date;
  };
  /** Matched route */
  route: {
    domain: string;
    behavior: string;
  };
  /** Additional context */
  context: Record<string, unknown>;
}

export interface PolicyDecision {
  /** Whether access is allowed */
  allowed: boolean;
  /** Matching policy */
  policy?: string;
  /** Denial reason */
  reason?: string;
  /** Conditions that matched */
  matchedConditions?: string[];
}

/**
 * Policy Engine
 */
export class PolicyEngine {
  private policies: Policy[];

  constructor(policies: Policy[] = []) {
    // Sort by priority (higher first)
    this.policies = [...policies].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  /**
   * Add a policy
   */
  addPolicy(policy: Policy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Remove a policy
   */
  removePolicy(name: string): boolean {
    const index = this.policies.findIndex((p) => p.name === name);
    if (index >= 0) {
      this.policies.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Evaluate policies against context
   */
  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    // Check each policy in priority order
    for (const policy of this.policies) {
      // Check if policy applies to this domain/behavior
      if (!this.policyApplies(policy, context)) {
        continue;
      }

      // Evaluate conditions
      const { matches, matchedConditions } = await this.evaluateConditions(
        policy.conditions,
        context
      );

      if (matches) {
        return {
          allowed: policy.effect === 'allow',
          policy: policy.name,
          reason: policy.effect === 'deny' ? policy.description : undefined,
          matchedConditions,
        };
      }
    }

    // Default: allow if no policy matches
    return { allowed: true };
  }

  /**
   * Check if policy applies to context
   */
  private policyApplies(policy: Policy, context: PolicyContext): boolean {
    // Check domain filter
    if (policy.domains && policy.domains.length > 0) {
      if (!policy.domains.includes(context.route.domain)) {
        return false;
      }
    }

    // Check behavior filter
    if (policy.behaviors && policy.behaviors.length > 0) {
      if (!policy.behaviors.includes(context.route.behavior)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate all conditions
   */
  private async evaluateConditions(
    conditions: PolicyCondition[],
    context: PolicyContext
  ): Promise<{ matches: boolean; matchedConditions: string[] }> {
    const matchedConditions: string[] = [];

    for (const condition of conditions) {
      const matches = await this.evaluateCondition(condition, context);

      if (!matches) {
        return { matches: false, matchedConditions: [] };
      }

      matchedConditions.push(`${condition.type}:${condition.operator}`);
    }

    return { matches: true, matchedConditions };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: PolicyCondition,
    context: PolicyContext
  ): Promise<boolean> {
    const value = this.extractValue(condition, context);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'not_equals':
        return value !== condition.value;

      case 'contains':
        if (typeof value === 'string') {
          return value.includes(condition.value as string);
        }
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        return false;

      case 'in':
        return (condition.value as unknown[]).includes(value);

      case 'not_in':
        return !(condition.value as unknown[]).includes(value);

      case 'matches':
        return new RegExp(condition.value as string).test(String(value));

      case 'gt':
        return (value as number) > (condition.value as number);

      case 'lt':
        return (value as number) < (condition.value as number);

      case 'gte':
        return (value as number) >= (condition.value as number);

      case 'lte':
        return (value as number) <= (condition.value as number);

      default:
        return false;
    }
  }

  /**
   * Extract value based on condition type
   */
  private extractValue(
    condition: PolicyCondition,
    context: PolicyContext
  ): unknown {
    switch (condition.type) {
      case 'role':
        return this.extractRole(context);

      case 'scope':
        return this.extractScopes(context);

      case 'claim':
        return this.extractClaim(context, condition.field ?? '');

      case 'ip':
        return context.request.clientIp;

      case 'time':
        return this.extractTimeValue(context, condition.field ?? 'hour');

      case 'rate':
        return context.context.currentRate ?? 0;

      case 'custom':
        return context.context[condition.field ?? ''];

      default:
        return undefined;
    }
  }

  /**
   * Extract role from context
   */
  private extractRole(context: PolicyContext): string | string[] {
    // Try JWT claims
    const auth = context.request.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      const payload = this.decodeJWTPayload(auth.slice(7));
      return payload?.role ?? payload?.roles ?? 'anonymous';
    }

    // Try custom header
    return context.request.headers['x-user-role'] ?? 'anonymous';
  }

  /**
   * Extract scopes from context
   */
  private extractScopes(context: PolicyContext): string[] {
    const auth = context.request.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      const payload = this.decodeJWTPayload(auth.slice(7));
      const scope = payload?.scope;
      if (typeof scope === 'string') {
        return scope.split(' ');
      }
      if (Array.isArray(scope)) {
        return scope;
      }
    }
    return [];
  }

  /**
   * Extract claim from JWT
   */
  private extractClaim(context: PolicyContext, field: string): unknown {
    const auth = context.request.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      const payload = this.decodeJWTPayload(auth.slice(7));
      return payload?.[field];
    }
    return undefined;
  }

  /**
   * Extract time-based value
   */
  private extractTimeValue(context: PolicyContext, field: string): number {
    const date = context.request.timestamp;

    switch (field) {
      case 'hour':
        return date.getHours();
      case 'day':
        return date.getDay();
      case 'month':
        return date.getMonth();
      case 'year':
        return date.getFullYear();
      default:
        return date.getTime();
    }
  }

  /**
   * Decode JWT payload (simplified - production should verify signature)
   */
  private decodeJWTPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  /**
   * Get all policies
   */
  getPolicies(): Policy[] {
    return [...this.policies];
  }
}

/**
 * Evaluate a policy
 */
export function evaluatePolicy(
  policy: Policy,
  context: PolicyContext
): Promise<PolicyDecision> {
  const engine = new PolicyEngine([policy]);
  return engine.evaluate(context);
}

/**
 * Common policy presets
 */
export const policyPresets = {
  /** Require authentication */
  requireAuth(): Policy {
    return {
      name: 'require-auth',
      description: 'Requires valid authentication',
      effect: 'deny',
      conditions: [
        { type: 'role', operator: 'equals', value: 'anonymous' },
      ],
    };
  },

  /** Require specific role */
  requireRole(role: string): Policy {
    return {
      name: `require-role-${role}`,
      description: `Requires ${role} role`,
      effect: 'allow',
      conditions: [
        { type: 'role', operator: 'equals', value: role },
      ],
    };
  },

  /** Require specific scope */
  requireScope(scope: string): Policy {
    return {
      name: `require-scope-${scope}`,
      description: `Requires ${scope} scope`,
      effect: 'allow',
      conditions: [
        { type: 'scope', operator: 'contains', value: scope },
      ],
    };
  },

  /** IP whitelist */
  ipWhitelist(ips: string[]): Policy {
    return {
      name: 'ip-whitelist',
      description: 'Allows only whitelisted IPs',
      effect: 'allow',
      conditions: [
        { type: 'ip', operator: 'in', value: ips },
      ],
    };
  },

  /** Business hours only */
  businessHoursOnly(): Policy {
    return {
      name: 'business-hours',
      description: 'Allows access only during business hours',
      effect: 'deny',
      conditions: [
        { type: 'time', operator: 'lt', field: 'hour', value: 9 },
      ],
    };
  },
};
