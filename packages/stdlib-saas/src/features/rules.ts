/**
 * Feature flag evaluation engine
 */

import { createHash } from 'crypto';
import { FeatureRule, FeatureEvaluationContext, FeatureEvaluationResult } from './types';
import { FeatureFlagError } from '../errors';

export class FeatureRuleEngine {
  /**
   * Evaluate a feature flag for a given context
   */
  static evaluate(
    rules: FeatureRule[],
    context: FeatureEvaluationContext,
    flagEnabled: boolean
  ): FeatureEvaluationResult {
    // If flag is globally disabled, return false immediately
    if (!flagEnabled) {
      return {
        enabled: false,
        source: 'global_disabled'
      };
    }

    // Sort rules by priority (higher priority first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    // Evaluate each rule in order
    for (const rule of sortedRules) {
      if (!rule.enabled) {
        continue;
      }

      const result = this.evaluateRule(rule, context);
      if (result !== null) {
        return {
          enabled: result,
          source: `rule_${rule.type}`,
          rule
        };
      }
    }

    // Default to disabled if no rules match
    return {
      enabled: false,
      source: 'default'
    };
  }

  /**
   * Evaluate a single rule
   */
  private static evaluateRule(
    rule: FeatureRule,
    context: FeatureEvaluationContext
  ): boolean | null {
    switch (rule.type) {
      case 'global':
        // Global rules return their value directly
        return typeof rule.value === 'boolean' ? rule.value : null;

      case 'plan':
        // Plan rules match if the tenant's plan matches
        return context.plan === rule.value ? true : null;

      case 'tenant':
        // Tenant-specific rules match if the tenant ID matches
        return context.tenantId === rule.value ? true : null;

      case 'user':
        // User-specific rules match if the user ID matches
        if (!context.userId) return null;
        return context.userId === rule.value ? true : null;

      case 'percentage':
        // Percentage rollouts are deterministic based on tenant ID
        if (typeof rule.value !== 'number') return null;
        return this.evaluatePercentageRollout(rule.value, context.tenantId);

      default:
        throw new FeatureFlagError(`Unknown rule type: ${rule.type}`);
    }
  }

  /**
   * Evaluate percentage rollout with deterministic hashing
   */
  private static evaluatePercentageRollout(percentage: number, tenantId: string): boolean {
    // Create a deterministic hash of the tenant ID
    const hash = createHash('md5').update(tenantId).digest('hex');
    
    // Convert first 8 characters to a number (0-255)
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const normalized = hashValue / 0xffffffff;
    
    // Return true if the hash falls within the percentage threshold
    return normalized * 100 < percentage;
  }

  /**
   * Check if a rule matches the context
   */
  static matchesRule(rule: FeatureRule, context: FeatureEvaluationContext): boolean {
    const result = this.evaluateRule(rule, context);
    return result === true;
  }

  /**
   * Get all applicable rules for a context
   */
  static getApplicableRules(
    rules: FeatureRule[],
    context: FeatureEvaluationContext
  ): FeatureRule[] {
    return rules.filter(rule => 
      rule.enabled && this.matchesRule(rule, context)
    );
  }

  /**
   * Validate rule configuration
   */
  static validateRule(rule: FeatureRule): void {
    switch (rule.type) {
      case 'global':
        if (typeof rule.value !== 'boolean') {
          throw new FeatureFlagError(
            `Global rule must have a boolean value, got ${typeof rule.value}`
          );
        }
        break;

      case 'plan':
        if (typeof rule.value !== 'string') {
          throw new FeatureFlagError(
            `Plan rule must have a string value, got ${typeof rule.value}`
          );
        }
        break;

      case 'tenant':
      case 'user':
        if (typeof rule.value !== 'string') {
          throw new FeatureFlagError(
            `${rule.type} rule must have a string value, got ${typeof rule.value}`
          );
        }
        break;

      case 'percentage':
        if (typeof rule.value !== 'number' || rule.value < 0 || rule.value > 100) {
          throw new FeatureFlagError(
            `Percentage rule must have a number between 0 and 100, got ${rule.value}`
          );
        }
        break;
    }
  }
}
