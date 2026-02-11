/**
 * Types and interfaces for rate limiting policies
 */

import { RateLimitAction, RateLimitConfig, RateLimitKey, IdentifierType, PolicyEvaluation, PolicyContext, TierConfig } from '../types';

// ============================================================================
// POLICY INTERFACES
// ============================================================================

export interface Policy {
  /**
   * Unique policy name
   */
  name: string;
  
  /**
   * Policy description
   */
  description?: string;
  
  /**
   * Policy priority (higher = evaluated first)
   */
  priority: number;
  
  /**
   * Policy conditions
   */
  conditions: PolicyCondition[];
  
  /**
   * Action to take when conditions are met
   */
  action: PolicyAction;
  
  /**
   * Policy metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * Evaluate the policy for a given context
   */
  evaluate(context: PolicyContext): Promise<PolicyEvaluation>;
  
  /**
   * Validate the policy configuration
   */
  validate(): void;
}

export interface PolicyCondition {
  /**
   * Condition type
   */
  type?: 'key' | 'identifier' | 'time' | 'metadata' | 'custom';
  
  /**
   * Field to check
   */
  field: string;
  
  /**
   * Operator for comparison
   */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  
  /**
   * Expected value(s)
   */
  value: any;
  
  /**
   * Case sensitive for string comparisons
   */
  caseSensitive?: boolean;
  
  /**
   * Custom evaluation function
   */
  customEvaluator?: (context: PolicyContext) => Promise<boolean>;
}

export interface PolicyAction {
  /**
   * Action type
   */
  type: RateLimitAction;
  
  /**
   * Rate limit configuration to apply
   */
  config?: RateLimitConfig;
  
  /**
   * Override parameters
   */
  overrides?: {
    limit?: number;
    windowMs?: number;
    burstLimit?: number;
  };
  
  /**
   * Action metadata
   */
  metadata?: Record<string, any>;
}

// ============================================================================
// POLICY ENGINE
// ============================================================================

export interface PolicyEngine {
  /**
   * Add a policy to the engine
   */
  addPolicy(policy: Policy): void;
  
  /**
   * Remove a policy by name
   */
  removePolicy(name: string): boolean;
  
  /**
   * Get a policy by name
   */
  getPolicy(name: string): Policy | undefined;
  
  /**
   * Get all policies
   */
  getPolicies(): Policy[];
  
  /**
   * Evaluate policies for a given context
   */
  evaluate(context: PolicyContext): Promise<PolicyEvaluation>;
  
  /**
   * Evaluate multiple contexts in batch
   */
  evaluateBatch(contexts: PolicyContext[]): Promise<PolicyEvaluation[]>;
  
  /**
   * Clear all policies
   */
  clear(): void;
  
  /**
   * Get policy evaluation metrics
   */
  getMetrics(): PolicyEngineMetrics;
}

export interface PolicyEngineConfig {
  /**
   * Enable caching of evaluation results
   */
  enableCache?: boolean;
  
  /**
   * Cache TTL in milliseconds
   */
  cacheTtlMs?: number;
  
  /**
   * Maximum cache size
   */
  maxCacheSize?: number;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
  
  /**
   * Default action when no policies match
   */
  defaultAction?: RateLimitAction;
  
  /**
   * Default configuration
   */
  defaultConfig?: RateLimitConfig;
}

// ============================================================================
// POLICY ENGINE METRICS
// ============================================================================

export interface PolicyEngineMetrics {
  /**
   * Total evaluations performed
   */
  totalEvaluations: number;
  
  /**
   * Evaluations by policy name
   */
  evaluationsByPolicy: Record<string, number>;
  
  /**
   * Evaluations by action
   */
  evaluationsByAction: Record<RateLimitAction, number>;
  
  /**
   * Cache hit rate (if caching enabled)
   */
  cacheHitRate?: number;
  
  /**
   * Average evaluation time in milliseconds
   */
  averageEvaluationTime: number;
  
  /**
   * Last evaluation timestamp
   */
  lastEvaluationTime: Date;
  
  /**
   * Number of loaded policies
   */
  policyCount: number;
}

// ============================================================================
// TIERED POLICY TYPES
// ============================================================================

export interface TieredPolicy extends Policy {
  /**
   * Type identifier for tiered policies
   */
  readonly type: 'tiered';
  
  /**
   * Available tiers
   */
  tiers: TierConfig[];
  
  /**
   * Default tier to use when no conditions match
   */
  defaultTier?: string;
  
  /**
   * Tier resolution strategy
   */
  resolutionStrategy: 'first-match' | 'highest-priority' | 'most-specific';
}

export interface TierCondition extends PolicyCondition {
  /**
   * Tier name this condition applies to
   */
  tierName: string;
}

export interface TierEvaluationContext extends PolicyContext {
  /**
   * Previously evaluated tier (for recursion detection)
   */
  previousTier?: string;
}

// ============================================================================
// POLICY LOADER
// ============================================================================

export interface PolicyLoader {
  /**
   * Load policies from a source
   */
  load(source: PolicySource): Promise<Policy[]>;
  
  /**
   * Load policies from a file
   */
  loadFromFile(filePath: string): Promise<Policy[]>;
  
  /**
   * Load policies from a URL
   */
  loadFromUrl(url: string): Promise<Policy[]>;
  
  /**
   * Load policies from a string
   */
  loadFromString(content: string, format?: PolicyFormat): Promise<Policy[]>;
  
  /**
   * Validate loaded policies
   */
  validate(policies: Policy[]): Promise<PolicyValidationResult>;
}

export interface PolicySource {
  /**
   * Source type
   */
  type: 'file' | 'url' | 'string' | 'database' | 'custom';
  
  /**
   * Source location or content
   */
  location?: string;
  
  /**
   * Source content (for string type)
   */
  content?: string;
  
  /**
   * Source format
   */
  format?: PolicyFormat;
  
  /**
   * Custom loader function
   */
  customLoader?: () => Promise<Policy[]>;
}

export type PolicyFormat = 'json' | 'yaml' | 'toml' | 'custom';

export interface PolicyValidationResult {
  /**
   * Overall validation status
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: PolicyValidationError[];
  
  /**
   * Validation warnings
   */
  warnings: PolicyValidationWarning[];
  
  /**
   * Valid policies
   */
  validPolicies: Policy[];
  
  /**
   * Invalid policies
   */
  invalidPolicies: Policy[];
}

export interface PolicyValidationError {
  /**
   * Policy name
   */
  policy: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error code
   */
  code: string;
  
  /**
   * Path to the error in the policy structure
   */
  path?: string;
}

export interface PolicyValidationWarning {
  /**
   * Policy name
   */
  policy: string;
  
  /**
   * Warning message
   */
  message: string;
  
  /**
   * Warning code
   */
  code: string;
  
  /**
   * Path to the warning in the policy structure
   */
  path?: string;
}

// ============================================================================
// POLICY TEMPLATES
// ============================================================================

export interface PolicyTemplate {
  /**
   * Template name
   */
  name: string;
  
  /**
   * Template description
   */
  description?: string;
  
  /**
   * Template parameters
   */
  parameters: PolicyTemplateParameter[];
  
  /**
   * Template policy definition (with placeholders)
   */
  template: Omit<Policy, 'name'>;
  
  /**
   * Instantiate the template with parameters
   */
  instantiate(params: Record<string, any>): Policy;
}

export interface PolicyTemplateParameter {
  /**
   * Parameter name
   */
  name: string;
  
  /**
   * Parameter type
   */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  /**
   * Parameter description
   */
  description?: string;
  
  /**
   * Default value
   */
  defaultValue?: any;
  
  /**
   * Required flag
   */
  required: boolean;
  
  /**
   * Validation rules
   */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

// ============================================================================
// POLICY EVENTS
// ============================================================================

export interface PolicyEvents {
  /**
   * Fired when a policy is added
   */
  policyAdded?: (policy: Policy) => void;
  
  /**
   * Fired when a policy is removed
   */
  policyRemoved?: (policyName: string) => void;
  
  /**
   * Fired when a policy is evaluated
   */
  policyEvaluated?: (policy: string, context: PolicyContext, result: PolicyEvaluation) => void;
  
  /**
   * Fired when policy evaluation fails
   */
  evaluationFailed?: (context: PolicyContext, error: Error) => void;
  
  /**
   * Fired when policies are reloaded
   */
  policiesReloaded?: (policies: Policy[]) => void;
}

// ============================================================================
// POLICY CACHE
// ============================================================================

export interface PolicyCache {
  /**
   * Get cached evaluation result
   */
  get(key: string): PolicyEvaluation | null;
  
  /**
   * Set cached evaluation result
   */
  set(key: string, result: PolicyEvaluation, ttlMs?: number): void;
  
  /**
   * Delete cached entry
   */
  delete(key: string): boolean;
  
  /**
   * Clear all cache entries
   */
  clear(): void;
  
  /**
   * Get cache statistics
   */
  getStats(): PolicyCacheStats;
}

export interface PolicyCacheStats {
  /**
   * Total entries in cache
   */
  size: number;
  
  /**
   * Cache hit count
   */
  hits: number;
  
  /**
   * Cache miss count
   */
  misses: number;
  
  /**
   * Cache hit rate
   */
  hitRate: number;
  
  /**
   * Cache evictions
   */
  evictions: number;
}

// ============================================================================
// POLICY UTILITIES
// ============================================================================

export interface PolicyUtils {
  /**
   * Generate cache key for policy evaluation
   */
  generateCacheKey(context: PolicyContext): string;
  
  /**
   * Compare two values using an operator
   */
  compareValues(left: any, operator: string, right: any, caseSensitive?: boolean): boolean;
  
  /**
   * Extract field value from context
   */
  extractFieldValue(context: PolicyContext, field: string): any;
  
  /**
   * Merge policy configurations
   */
  mergeConfigs(base: RateLimitConfig, override?: Partial<RateLimitConfig>): RateLimitConfig;
  
  /**
   * Validate policy name
   */
  validatePolicyName(name: string): boolean;
  
  /**
   * Normalize policy priority
   */
  normalizePriority(priority: number): number;
}

// ============================================================================
// RE-EXPORTS FROM MAIN TYPES
// ============================================================================

export type { PolicyEvaluation, PolicyContext, TierConfig } from '../types';
