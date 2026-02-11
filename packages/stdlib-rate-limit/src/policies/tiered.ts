/**
 * Tiered policy implementation for multi-level rate limiting
 * 
 * This module provides tiered rate limiting policies where different
 * users/clients can have different rate limits based on their tier.
 */

import { RateLimitAction, RateLimitConfig } from '../types';
import { 
  TieredPolicy, 
  TierConfig, 
  TierCondition, 
  TierEvaluationContext,
  PolicyEvaluation,
  PolicyContext,
  PolicyUtils
} from './types';
import { PolicyError, CircularPolicyReferenceError } from '../errors';
import { BasePolicy, PolicyUtilsImpl } from './policy';

/**
 * Tiered policy implementation
 */
export class TieredPolicyImpl extends BasePolicy implements TieredPolicy {
  public readonly type = 'tiered' as const;
  public readonly tiers: TierConfig[];
  public defaultTier?: string;
  public readonly resolutionStrategy: 'first-match' | 'highest-priority' | 'most-specific';
  
  private utils: PolicyUtils;
  
  constructor(policy: {
    name: string;
    description?: string;
    priority: number;
    tiers: TierConfig[];
    defaultTier?: string;
    resolutionStrategy?: 'first-match' | 'highest-priority' | 'most-specific';
    metadata?: Record<string, any>;
  }) {
    // Convert tiers to policy conditions and action
    const conditions: TierCondition[] = [];
    const action = {
      type: RateLimitAction.ALLOW,
      config: undefined as RateLimitConfig | undefined,
    };
    
    // Validate tiers
    if (!policy.tiers || policy.tiers.length === 0) {
      throw new PolicyError('Tiered policy must have at least one tier', policy.name);
    }
    
    // Validate default tier exists
    if (policy.defaultTier && !policy.tiers.find(t => t.name === policy.defaultTier)) {
      throw new PolicyError(`Default tier '${policy.defaultTier}' not found in tiers`, policy.name);
    }
    
    // Sort tiers by priority (highest first)
    const sortedTiers = [...policy.tiers].sort((a, b) => b.priority - a.priority);
    
    // Create conditions for each tier
    for (const tier of sortedTiers) {
      for (const condition of tier.conditions) {
        conditions.push({
          ...condition,
          tierName: tier.name,
        });
      }
    }
    
    super({
      name: policy.name,
      description: policy.description,
      priority: policy.priority,
      conditions,
      action,
      metadata: policy.metadata,
    });
    
    this.tiers = sortedTiers;
    this.defaultTier = policy.defaultTier;
    this.resolutionStrategy = policy.resolutionStrategy || 'first-match';
    this.utils = new PolicyUtilsImpl();
  }
  
  async evaluate(context: PolicyContext): Promise<PolicyEvaluation> {
    const tierContext: TierEvaluationContext = {
      ...context,
      previousTier: undefined,
    };
    
    // Find matching tier
    const matchingTier = await this.findMatchingTier(tierContext);
    
    if (!matchingTier) {
      // No tier matched, use default if available
      if (this.defaultTier) {
        const defaultTier = this.tiers.find(t => t.name === this.defaultTier);
        if (defaultTier) {
          return {
            action: RateLimitAction.ALLOW,
            config: defaultTier.config,
            reason: `Using default tier: ${this.defaultTier}`,
            metadata: { tier: this.defaultTier },
          };
        }
      }
      
      // No tier matched and no default
      return {
        action: RateLimitAction.ALLOW,
        reason: 'No tier matched and no default tier configured',
      };
    }
    
    // Check for circular references
    if (tierContext.previousTier === matchingTier.name) {
      throw new CircularPolicyReferenceError([tierContext.previousTier]);
    }
    
    return {
      action: RateLimitAction.ALLOW,
      config: matchingTier.config,
      reason: `Matched tier: ${matchingTier.name}`,
      metadata: { tier: matchingTier.name },
    };
  }
  
  private async findMatchingTier(context: TierEvaluationContext): Promise<TierConfig | null> {
    const matchingTiers: TierConfig[] = [];
    
    // Evaluate each tier
    for (const tier of this.tiers) {
      const tierMatches = await this.evaluateTierConditions(tier, context);
      
      if (tierMatches) {
        matchingTiers.push(tier);
      }
    }
    
    // No tiers matched
    if (matchingTiers.length === 0) {
      return null;
    }
    
    // Apply resolution strategy
    switch (this.resolutionStrategy) {
      case 'first-match':
        return matchingTiers[0];
        
      case 'highest-priority':
        // Tiers are already sorted by priority
        return matchingTiers[0];
        
      case 'most-specific':
        // Find tier with most matching conditions
        return matchingTiers.reduce((most, current) => {
          const mostConditions = most.conditions.length;
          const currentConditions = current.conditions.length;
          return currentConditions > mostConditions ? current : most;
        });
        
      default:
        return matchingTiers[0];
    }
  }
  
  private async evaluateTierConditions(tier: TierConfig, context: TierEvaluationContext): Promise<boolean> {
    // All conditions in a tier must match (AND logic)
    for (const condition of tier.conditions) {
      const matches = await this.evaluateCondition(condition, context);
      if (!matches) {
        return false;
      }
    }
    
    return true;
  }
  
  private async evaluateCondition(condition: any, context: TierEvaluationContext): Promise<boolean> {
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
  
  /**
   * Get tier by name
   */
  getTier(name: string): TierConfig | undefined {
    return this.tiers.find(t => t.name === name);
  }
  
  /**
   * Get all tiers
   */
  getTiers(): TierConfig[] {
    return [...this.tiers];
  }
  
  /**
   * Add a new tier
   */
  addTier(tier: TierConfig): void {
    if (this.tiers.find(t => t.name === tier.name)) {
      throw new PolicyError(`Tier '${tier.name}' already exists`, this.name);
    }
    
    this.tiers.push(tier);
    
    // Re-sort tiers by priority
    this.tiers.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Remove a tier - returns a new instance
   */
  removeTier(name: string): { policy: TieredPolicy; removed: boolean } {
    const index = this.tiers.findIndex(t => t.name === name);
    
    if (index === -1) {
      return { policy: this, removed: false };
    }
    
    // Create new tiers array without the removed tier
    const newTiers = [...this.tiers];
    newTiers.splice(index, 1);
    
    // Check if it's the default tier
    const newDefaultTier = this.defaultTier === name ? undefined : this.defaultTier;
    
    // Create new instance
    const newPolicy = new TieredPolicyImpl({
      name: this.name,
      description: this.description,
      priority: this.priority,
      tiers: newTiers,
      defaultTier: newDefaultTier,
      resolutionStrategy: this.resolutionStrategy,
      metadata: this.metadata,
    });
    
    return { policy: newPolicy, removed: true };
  }
  
  /**
   * Update default tier - returns a new instance
   */
  setDefaultTier(name?: string): TieredPolicy {
    if (name && !this.tiers.find(t => t.name === name)) {
      throw new PolicyError(`Tier '${name}' not found`, this.name);
    }
    
    // Create new instance with updated default tier
    return new TieredPolicyImpl({
      name: this.name,
      description: this.description,
      priority: this.priority,
      tiers: this.tiers,
      defaultTier: name,
      resolutionStrategy: this.resolutionStrategy,
      metadata: this.metadata,
    });
  }
}

/**
 * Tier factory for creating common tier configurations
 */
export class TierFactory {
  /**
   * Create a free tier with basic limits
   */
  static createFreeTier(config?: Partial<RateLimitConfig>): TierConfig {
    return {
      name: 'free',
      priority: 10,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.plan',
          operator: 'eq',
          value: 'free',
        },
      ],
      config: {
        name: 'free-tier',
        limit: 100,
        windowMs: 3600000, // 1 hour
        ...config,
      },
    };
  }
  
  /**
   * Create a basic tier with moderate limits
   */
  static createBasicTier(config?: Partial<RateLimitConfig>): TierConfig {
    return {
      name: 'basic',
      priority: 50,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.plan',
          operator: 'eq',
          value: 'basic',
        },
      ],
      config: {
        name: 'basic-tier',
        limit: 1000,
        windowMs: 3600000, // 1 hour
        ...config,
      },
    };
  }
  
  /**
   * Create a premium tier with high limits
   */
  static createPremiumTier(config?: Partial<RateLimitConfig>): TierConfig {
    return {
      name: 'premium',
      priority: 100,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.plan',
          operator: 'eq',
          value: 'premium',
        },
      ],
      config: {
        name: 'premium-tier',
        limit: 10000,
        windowMs: 3600000, // 1 hour
        ...config,
      },
    };
  }
  
  /**
   * Create an enterprise tier with very high limits
   */
  static createEnterpriseTier(config?: Partial<RateLimitConfig>): TierConfig {
    return {
      name: 'enterprise',
      priority: 200,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.plan',
          operator: 'eq',
          value: 'enterprise',
        },
      ],
      config: {
        name: 'enterprise-tier',
        limit: 100000,
        windowMs: 3600000, // 1 hour
        ...config,
      },
    };
  }
  
  /**
   * Create a tier based on user role
   */
  static createRoleTier(role: string, priority: number, config: RateLimitConfig): TierConfig {
    return {
      name: `${role}-role`,
      priority,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.role',
          operator: 'eq',
          value: role,
        },
      ],
      config,
    };
  }
  
  /**
   * Create a tier based on API key type
   */
  static createApiKeyTier(keyType: string, priority: number, config: RateLimitConfig): TierConfig {
    return {
      name: `${keyType}-key`,
      priority,
      conditions: [
        {
          type: 'metadata',
          field: 'metadata.keyType',
          operator: 'eq',
          value: keyType,
        },
      ],
      config,
    };
  }
  
  /**
   * Create a tier based on request volume
   */
  static createVolumeTier(
    name: string,
    priority: number,
    minRequests: number,
    maxRequests: number,
    config: RateLimitConfig
  ): TierConfig {
    return {
      name,
      priority,
      conditions: [
        {
          field: 'requestCount',
          operator: 'gte',
          value: minRequests,
        },
        {
          field: 'requestCount',
          operator: 'lte',
          value: maxRequests,
        },
      ],
      config,
    };
  }
}

/**
 * Create a tiered policy
 */
export function createTieredPolicy(policy: {
  name: string;
  description?: string;
  priority: number;
  tiers: TierConfig[];
  defaultTier?: string;
  resolutionStrategy?: 'first-match' | 'highest-priority' | 'most-specific';
  metadata?: Record<string, any>;
}): TieredPolicy {
  return new TieredPolicyImpl(policy);
}

/**
 * Create a tiered policy with common tiers
 */
export function createStandardTieredPolicy(name: string, options?: {
  defaultTier?: string;
  customConfigs?: {
    free?: Partial<RateLimitConfig>;
    basic?: Partial<RateLimitConfig>;
    premium?: Partial<RateLimitConfig>;
    enterprise?: Partial<RateLimitConfig>;
  };
}): TieredPolicy {
  const tiers = [
    TierFactory.createFreeTier(options?.customConfigs?.free),
    TierFactory.createBasicTier(options?.customConfigs?.basic),
    TierFactory.createPremiumTier(options?.customConfigs?.premium),
    TierFactory.createEnterpriseTier(options?.customConfigs?.enterprise),
  ];
  
  return createTieredPolicy({
    name,
    description: 'Standard tiered rate limiting policy',
    priority: 100,
    tiers,
    defaultTier: options?.defaultTier || 'free',
    resolutionStrategy: 'highest-priority',
  });
}
