/**
 * Policy Engine Types
 */

export interface Policy {
  id: string;
  name: string;
  description?: string;
  version: string;
  rules: PolicyRule[];
  scope: PolicyScope;
  enforcement: EnforcementMode;
  priority: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  condition: PolicyCondition;
  effect: PolicyEffect;
  obligations?: PolicyObligation[];
}

export interface PolicyCondition {
  type: ConditionType;
  operator?: ConditionOperator;
  value?: unknown;
  children?: PolicyCondition[];
  attribute?: string;
  function?: string;
  args?: unknown[];
}

export type ConditionType = 
  | 'attribute'
  | 'function'
  | 'and'
  | 'or'
  | 'not'
  | 'all'
  | 'any'
  | 'none';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'exists'
  | 'notExists';

export type PolicyEffect = 'ALLOW' | 'DENY' | 'AUDIT' | 'WARN';

export interface PolicyObligation {
  type: string;
  params?: Record<string, unknown>;
}

export interface PolicyScope {
  domains?: string[];
  behaviors?: string[];
  entities?: string[];
  principals?: string[];
  resources?: string[];
  environments?: string[];
}

export type EnforcementMode = 'ENFORCING' | 'PERMISSIVE' | 'DISABLED';

export interface PolicyContext {
  principal?: PrincipalContext;
  resource?: ResourceContext;
  action?: ActionContext;
  environment?: EnvironmentContext;
  attributes?: Record<string, unknown>;
}

export interface PrincipalContext {
  id: string;
  type: string;
  roles?: string[];
  groups?: string[];
  attributes?: Record<string, unknown>;
}

export interface ResourceContext {
  id?: string;
  type: string;
  domain?: string;
  owner?: string;
  attributes?: Record<string, unknown>;
}

export interface ActionContext {
  name: string;
  domain?: string;
  type?: 'behavior' | 'query' | 'mutation';
  attributes?: Record<string, unknown>;
}

export interface EnvironmentContext {
  name?: string;
  timestamp?: number;
  ipAddress?: string;
  userAgent?: string;
  attributes?: Record<string, unknown>;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  policy?: string;
  rule?: string;
  reason?: string;
  obligations?: PolicyObligation[];
  context?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decisions: PolicyDecision[];
  matchedPolicies: string[];
  evaluationTime: number;
  context: PolicyContext;
}

export interface PolicySet {
  id: string;
  name: string;
  description?: string;
  policies: Policy[];
  combiningAlgorithm: CombiningAlgorithm;
}

export type CombiningAlgorithm =
  | 'DENY_OVERRIDES'
  | 'PERMIT_OVERRIDES'
  | 'FIRST_APPLICABLE'
  | 'ONLY_ONE_APPLICABLE'
  | 'ORDERED_DENY_OVERRIDES'
  | 'ORDERED_PERMIT_OVERRIDES';

export interface PolicyAuditLog {
  timestamp: string;
  requestId: string;
  context: PolicyContext;
  result: PolicyEvaluationResult;
  duration: number;
}

export interface PolicyStats {
  totalEvaluations: number;
  allowedCount: number;
  deniedCount: number;
  averageEvaluationTime: number;
  policyHits: Record<string, number>;
}
