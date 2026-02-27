/**
 * Feature Flags Types
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  variants?: Variant[];
  defaultVariant?: string;
  targeting?: TargetingRule[];
  rollout?: RolloutConfig;
  behaviors?: BehaviorOverride[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface Variant {
  key: string;
  name: string;
  value: unknown;
  weight?: number;
  payload?: Record<string, unknown>;
}

export interface TargetingRule {
  id: string;
  priority: number;
  conditions: Condition[];
  variant: string;
  description?: string;
}

export interface Condition {
  attribute: string;
  operator: ConditionOperator;
  value: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'before'
  | 'after'
  | 'semverEquals'
  | 'semverGreaterThan'
  | 'semverLessThan';

export interface RolloutConfig {
  type: 'percentage' | 'gradual' | 'scheduled';
  percentage?: number;
  schedule?: {
    startAt: string;
    endAt?: string;
    startPercentage: number;
    endPercentage: number;
  };
  stickiness?: string;
}

export interface BehaviorOverride {
  behavior: string;
  domain?: string;
  modifications: BehaviorModification[];
}

export interface BehaviorModification {
  type: 'addPrecondition' | 'addPostcondition' | 'modifyInput' | 'modifyOutput' | 'disable';
  target?: string;
  value?: unknown;
  condition?: string;
}

export interface EvaluationContext {
  userId?: string;
  orgId?: string;
  sessionId?: string;
  attributes?: Record<string, unknown>;
  environment?: string;
  timestamp?: number;
}

export interface EvaluationResult {
  flagKey: string;
  enabled: boolean;
  variant?: string;
  value?: unknown;
  reason: EvaluationReason;
  metadata?: Record<string, unknown>;
  /**
   * Detailed reasoning about why this evaluation decision was made.
   * Includes bucketing information, targeting rule matches, etc.
   */
  reasoning?: EvaluationReasoning;
}

export interface EvaluationReasoning {
  /**
   * The bucket value (0-100) assigned to this user/org for deterministic rollout
   */
  bucket?: number;
  /**
   * The stickiness key used for bucketing (userId, orgId, etc.)
   */
  stickinessKey?: string;
  /**
   * The stickiness value used for bucketing
   */
  stickinessValue?: string;
  /**
   * Percentage threshold used in rollout evaluation
   */
  rolloutPercentage?: number;
  /**
   * Which targeting rule matched, if any
   */
  matchedTargetingRuleId?: string;
  /**
   * Which conditions matched in targeting evaluation
   */
  matchedConditions?: Array<{ attribute: string; operator: string; value: unknown }>;
  /**
   * Hash value used for deterministic bucketing
   */
  hashValue?: number;
}

export type EvaluationReason =
  | 'FLAG_DISABLED'
  | 'DEFAULT_VARIANT'
  | 'TARGETING_MATCH'
  | 'ROLLOUT'
  | 'OVERRIDE'
  | 'ERROR';

export interface FlagProviderConfig {
  source: 'local' | 'remote' | 'hybrid';
  localFlags?: FeatureFlag[];
  remoteUrl?: string;
  apiKey?: string;
  refreshInterval?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  defaultOnError?: boolean;
  onFlagChange?: (flags: FeatureFlag[]) => void;
  onError?: (error: Error) => void;
}

export interface FlagAuditEvent {
  timestamp: string;
  flagKey: string;
  action: 'evaluate' | 'update' | 'create' | 'delete';
  context?: EvaluationContext;
  result?: EvaluationResult;
  previousValue?: unknown;
  newValue?: unknown;
  actor?: string;
  /**
   * Detailed reasoning proving why the flag evaluated a certain way
   */
  reasoning?: EvaluationReasoning;
}

export interface BehaviorGate {
  flagKey: string;
  behavior: string;
  domain?: string;
  gateType: 'enable' | 'disable' | 'modify';
  variantModifications?: Map<string, BehaviorModification[]>;
}
