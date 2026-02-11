/**
 * Core policy implementation and policy engine for rate limiting
 */

import { RateLimitAction, RateLimitConfig } from '../types';
import { 
  Policy, 
  PolicyCondition, 
  PolicyAction, 
  PolicyEngine, 
  PolicyEngineConfig,
  PolicyEngineMetrics,
  PolicyEvaluation,
  PolicyContext,
  PolicyEvents,
  PolicyCache,
  PolicyCacheStats,
  PolicyUtils
} from './types';
import { PolicyError, PolicyEvaluationError } from '../errors';

/**
 * Base policy implementation
 */
export class BasePolicy implements Policy {
  public readonly name: string;
  public readonly description?: string;
  public readonly priority: number;
  public readonly conditions: PolicyCondition[];
  public readonly action: PolicyAction;
  public readonly metadata?: Record<string, any>;
  
  private utils: PolicyUtils;
  
  constructor(policy: {
    name: string;
    description?: string;
    priority: number;
    conditions: PolicyCondition[];
    action: PolicyAction;
    metadata?: Record<string, any>;
  }) {
    this.name = policy.name;
    this.description = policy.description;
    this.priority = policy.priority;
    this.conditions = policy.conditions;
    this.action = policy.action;
    this.metadata = policy.metadata;
    
    this.utils = new PolicyUtilsImpl();
    
    // Validate policy on creation
    this.validate();
  }
  
  async evaluate(context: PolicyContext): Promise<PolicyEvaluation> {
    try {
      // Evaluate all conditions
      for (const condition of this.conditions) {
        const result = await this.evaluateCondition(condition, context);
        if (!result) {
          // Condition failed, policy doesn't apply
          return {
            action: RateLimitAction.ALLOW, // Default action
            reason: `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`,
          };
        }
      }
      
      // All conditions passed, policy applies
      return {
        action: this.action.type,
        config: this.action.config,
        reason: `Policy '${this.name}' matched`,
        metadata: this.action.metadata,
      };
      
    } catch (error) {
      throw new PolicyEvaluationError(this.name, (error as Error).message);
    }
  }
  
  validate(): void {
    // Validate name
    if (!this.name || typeof this.name !== 'string') {
      throw new PolicyError('Policy name is required and must be a string', this.name);
    }
    
    if (!this.utils.validatePolicyName(this.name)) {
      throw new PolicyError(`Invalid policy name: ${this.name}`, this.name);
    }
    
    // Validate priority
    if (typeof this.priority !== 'number' || this.priority < 0) {
      throw new PolicyError('Policy priority must be a non-negative number', this.name);
    }
    
    // Validate conditions
    if (!Array.isArray(this.conditions) || this.conditions.length === 0) {
      throw new PolicyError('Policy must have at least one condition', this.name);
    }
    
    for (const condition of this.conditions) {
      this.validateCondition(condition);
    }
    
    // Validate action
    if (!this.action || typeof this.action !== 'object') {
      throw new PolicyError('Policy action is required', this.name);
    }
    
    if (!Object.values(RateLimitAction).includes(this.action.type)) {
      throw new PolicyError(`Invalid action type: ${this.action.type}`, this.name);
    }
    
    if (this.action.config) {
      this.validateConfig(this.action.config);
    }
  }
  
  private async evaluateCondition(condition: PolicyCondition, context: PolicyContext): Promise<boolean> {
    if (condition.customEvaluator) {
      return await condition.customEvaluator(context);
    }
    
    const fieldValue = this.utils.extractFieldValue(context, condition.field);
    return this.utils.compareValues(
      fieldValue,
      condition.operator,
      condition.value,
      condition.caseSensitive
    );
  }
  
  private validateCondition(condition: PolicyCondition): void {
    const validTypes = ['key', 'identifier', 'time', 'metadata', 'custom'];
    if (condition.type !== undefined && !validTypes.includes(condition.type)) {
      throw new PolicyError(`Invalid condition type: ${condition.type}`, this.name);
    }
    
    if (!condition.field || typeof condition.field !== 'string') {
      throw new PolicyError('Condition field is required and must be a string', this.name);
    }
    
    if (!condition.operator || !Object.values(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']).includes(condition.operator)) {
      throw new PolicyError(`Invalid condition operator: ${condition.operator}`, this.name);
    }
    
    if (condition.type !== 'custom' && condition.value === undefined) {
      throw new PolicyError('Condition value is required for non-custom conditions', this.name);
    }
  }
  
  private validateConfig(config: RateLimitConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new PolicyError('Config name is required', this.name);
    }
    
    if (typeof config.limit !== 'number' || config.limit <= 0) {
      throw new PolicyError('Config limit must be a positive number', this.name);
    }
    
    if (typeof config.windowMs !== 'number' || config.windowMs <= 0) {
      throw new PolicyError('Config windowMs must be a positive number', this.name);
    }
  }
}

/**
 * In-memory policy cache implementation
 */
export class MemoryPolicyCache implements PolicyCache {
  private cache = new Map<string, { result: PolicyEvaluation; expiry: Date }>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  
  get(key: string): PolicyEvaluation | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (entry.expiry < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.result;
  }
  
  set(key: string, result: PolicyEvaluation, ttlMs: number = 300000): void {
    // Simple LRU: if cache is too large, remove oldest entries
    if (this.cache.size >= 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    const expiry = new Date(Date.now() + ttlMs);
    this.cache.set(key, { result, expiry });
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }
  
  getStats(): PolicyCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    };
  }
}

/**
 * Policy engine implementation
 */
export class PolicyEngineImpl implements PolicyEngine {
  private policies = new Map<string, Policy>();
  private cache?: PolicyCache;
  private events: Partial<PolicyEvents> = {};
  private metrics: PolicyEngineMetrics;
  private config: PolicyEngineConfig;
  private utils: PolicyUtils;
  
  constructor(config: PolicyEngineConfig = {}) {
    this.config = {
      enableCache: true,
      cacheTtlMs: 300000, // 5 minutes
      maxCacheSize: 1000,
      debug: false,
      defaultAction: RateLimitAction.ALLOW,
      ...config,
    };
    
    if (this.config.enableCache) {
      this.cache = new MemoryPolicyCache();
    }
    
    this.utils = new PolicyUtilsImpl();
    
    this.metrics = {
      totalEvaluations: 0,
      evaluationsByPolicy: {},
      evaluationsByAction: {
        [RateLimitAction.ALLOW]: 0,
        [RateLimitAction.WARN]: 0,
        [RateLimitAction.THROTTLE]: 0,
        [RateLimitAction.DENY]: 0,
        [RateLimitAction.CAPTCHA]: 0,
      },
      averageEvaluationTime: 0,
      lastEvaluationTime: new Date(),
      policyCount: 0,
    };
  }
  
  addPolicy(policy: Policy): void {
    if (this.policies.has(policy.name)) {
      throw new PolicyError(`Policy '${policy.name}' already exists`);
    }
    
    this.policies.set(policy.name, policy);
    this.metrics.policyCount = this.policies.size;
    
    this.events.policyAdded?.(policy);
    
    if (this.config.debug) {
      console.debug(`[PolicyEngine] Added policy: ${policy.name}`);
    }
  }
  
  removePolicy(name: string): boolean {
    const removed = this.policies.delete(name);
    
    if (removed) {
      this.metrics.policyCount = this.policies.size;
      this.events.policyRemoved?.(name);
      
      if (this.config.debug) {
        console.debug(`[PolicyEngine] Removed policy: ${name}`);
      }
    }
    
    return removed;
  }
  
  getPolicy(name: string): Policy | undefined {
    return this.policies.get(name);
  }
  
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }
  
  async evaluate(context: PolicyContext): Promise<PolicyEvaluation> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalEvaluations++;
      
      // Check cache first
      if (this.cache) {
        const cacheKey = this.utils.generateCacheKey(context);
        const cached = this.cache.get(cacheKey);
        
        if (cached) {
          this.updateMetrics(cached.action, Date.now() - startTime);
          return cached;
        }
      }
      
      // Sort policies by priority (highest first)
      const sortedPolicies = Array.from(this.policies.values())
        .sort((a, b) => b.priority - a.priority);
      
      // Evaluate policies in order
      for (const policy of sortedPolicies) {
        try {
          const result = await policy.evaluate(context);
          
          // Return if policy matched with a non-ALLOW action, or an ALLOW with specific config
          if (result.action !== RateLimitAction.ALLOW || result.config !== undefined) {
            this.updateMetricsForPolicy(policy.name, result.action, Date.now() - startTime);
            
            // Cache the result
            if (this.cache) {
              const cacheKey = this.utils.generateCacheKey(context);
              this.cache.set(cacheKey, result, this.config.cacheTtlMs);
            }
            
            this.events.policyEvaluated?.(policy.name, context, result);
            return result;
          }
          
        } catch (error) {
          this.events.evaluationFailed?.(context, error as Error);
          
          if (this.config.debug) {
            console.error(`[PolicyEngine] Policy evaluation failed for ${policy.name}:`, error);
          }
          
          // Continue to next policy on error
        }
      }
      
      // No policies matched, use default
      const defaultResult: PolicyEvaluation = {
        action: this.config.defaultAction || RateLimitAction.ALLOW,
        config: this.config.defaultConfig,
        reason: 'No policies matched',
      };
      
      this.updateMetrics(defaultResult.action, Date.now() - startTime);
      
      // Cache the default result
      if (this.cache) {
        const cacheKey = this.utils.generateCacheKey(context);
        this.cache.set(cacheKey, defaultResult, this.config.cacheTtlMs);
      }
      
      return defaultResult;
      
    } finally {
      this.metrics.lastEvaluationTime = new Date();
    }
  }
  
  async evaluateBatch(contexts: PolicyContext[]): Promise<PolicyEvaluation[]> {
    const results: PolicyEvaluation[] = [];
    
    // Process in parallel for better performance
    const promises = contexts.map(context => this.evaluate(context));
    const batchResults = await Promise.all(promises);
    
    results.push(...batchResults);
    return results;
  }
  
  clear(): void {
    this.policies.clear();
    this.cache?.clear();
    
    this.metrics = {
      totalEvaluations: 0,
      evaluationsByPolicy: {},
      evaluationsByAction: {
        [RateLimitAction.ALLOW]: 0,
        [RateLimitAction.WARN]: 0,
        [RateLimitAction.THROTTLE]: 0,
        [RateLimitAction.DENY]: 0,
        [RateLimitAction.CAPTCHA]: 0,
      },
      averageEvaluationTime: 0,
      lastEvaluationTime: new Date(),
      policyCount: 0,
    };
    
    if (this.config.debug) {
      console.debug('[PolicyEngine] Cleared all policies and metrics');
    }
  }
  
  getMetrics(): PolicyEngineMetrics {
    const cacheStats = this.cache?.getStats();
    
    return {
      ...this.metrics,
      cacheHitRate: cacheStats?.hitRate,
    };
  }
  
  on(events: Partial<PolicyEvents>): void {
    this.events = { ...this.events, ...events };
  }
  
  private updateMetrics(action: RateLimitAction, duration: number): void {
    // Update action metrics
    this.metrics.evaluationsByAction[action]++;
    
    // Update average evaluation time
    this.metrics.averageEvaluationTime = 
      (this.metrics.averageEvaluationTime * (this.metrics.totalEvaluations - 1) + duration) 
      / this.metrics.totalEvaluations;
  }
  
  private updateMetricsForPolicy(policyName: string, action: RateLimitAction, duration: number): void {
    // Update policy-specific metrics
    this.metrics.evaluationsByPolicy[policyName] = 
      (this.metrics.evaluationsByPolicy[policyName] || 0) + 1;
    
    // Update general metrics
    this.updateMetrics(action, duration);
  }
}

/**
 * Policy utilities implementation
 */
export class PolicyUtilsImpl implements PolicyUtils {
  generateCacheKey(context: PolicyContext): string {
    const parts = [
      context.key,
      context.identifierType,
      context.requestCount.toString(),
      context.windowStart.toISOString(),
    ];
    
    // Add metadata hash if present
    if (context.metadata) {
      parts.push(JSON.stringify(context.metadata));
    }
    
    return parts.join(':');
  }
  
  compareValues(left: any, operator: string, right: any, caseSensitive: boolean = true): boolean {
    // Handle null/undefined
    if (left == null || right == null) {
      switch (operator) {
        case 'eq':
          return left === right;
        case 'ne':
          return left !== right;
        default:
          return false;
      }
    }
    
    // Convert to strings for string operations
    if (typeof left === 'string' || typeof right === 'string') {
      if (!caseSensitive) {
        left = typeof left === 'string' ? left.toLowerCase() : left;
        right = typeof right === 'string' ? right.toLowerCase() : right;
      }
    }
    
    switch (operator) {
      case 'eq':
        return left === right;
      case 'ne':
        return left !== right;
      case 'gt':
        return left > right;
      case 'gte':
        return left >= right;
      case 'lt':
        return left < right;
      case 'lte':
        return left <= right;
      case 'in':
        return Array.isArray(right) && right.includes(left);
      case 'nin':
        return Array.isArray(right) && !right.includes(left);
      case 'contains':
        if (typeof left === 'string') {
          return left.includes(right);
        }
        if (Array.isArray(left)) {
          return left.includes(right);
        }
        return false;
      case 'regex':
        try {
          const regex = new RegExp(right, caseSensitive ? 'g' : 'gi');
          return regex.test(String(left));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
  
  extractFieldValue(context: PolicyContext, field: string): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value == null || typeof value !== 'object') {
        return undefined;
      }
      value = value[part];
    }
    
    return value;
  }
  
  mergeConfigs(base: RateLimitConfig, override?: Partial<RateLimitConfig>): RateLimitConfig {
    if (!override) {
      return base;
    }
    
    return {
      ...base,
      ...override,
      // Handle nested objects
      tags: override.tags || base.tags,
    };
  }
  
  validatePolicyName(name: string): boolean {
    // Policy names should be alphanumeric with hyphens and underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }
  
  normalizePriority(priority: number): number {
    // Ensure priority is within valid range
    return Math.max(0, Math.min(999999, priority));
  }
}

/**
 * Create a new policy
 */
export function createPolicy(policy: {
  name: string;
  description?: string;
  priority: number;
  conditions: PolicyCondition[];
  action: PolicyAction;
  metadata?: Record<string, any>;
}): Policy {
  return new BasePolicy(policy);
}

/**
 * Create a new policy engine
 */
export function createPolicyEngine(config?: PolicyEngineConfig): PolicyEngine {
  return new PolicyEngineImpl(config);
}
