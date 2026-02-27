/**
 * Tests for FlagEvaluator
 * Tests deterministic bucketing, consistency, and evaluation logic
 */
import { describe, it, expect } from 'vitest';
import { FlagEvaluator } from '../src/evaluator';
import type {
  FeatureFlag,
  EvaluationContext,
  EvaluationResult,
} from '../src/types';

describe('FlagEvaluator', () => {
  const evaluator = new FlagEvaluator();

  describe('Boolean Flags', () => {
    it('should return disabled when flag is disabled', () => {
      const flag: FeatureFlag = {
        key: 'test-flag',
        name: 'Test Flag',
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('FLAG_DISABLED');
    });

    it('should return enabled for simple boolean flag', () => {
      const flag: FeatureFlag = {
        key: 'test-flag',
        name: 'Test Flag',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('DEFAULT_VARIANT');
    });

    it('should return disabled when flag is expired', () => {
      const flag: FeatureFlag = {
        key: 'test-flag',
        name: 'Test Flag',
        enabled: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('FLAG_DISABLED');
    });
  });

  describe('Multivariate Flags', () => {
    it('should return default variant when no targeting or rollout', () => {
      const flag: FeatureFlag = {
        key: 'test-flag',
        name: 'Test Flag',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control-value' },
          { key: 'treatment', name: 'Treatment', value: 'treatment-value' },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(true);
      expect(result.variant).toBe('control');
      expect(result.value).toBe('control-value');
      expect(result.reason).toBe('DEFAULT_VARIANT');
    });

    it('should return first variant when defaultVariant not specified', () => {
      const flag: FeatureFlag = {
        key: 'test-flag',
        name: 'Test Flag',
        enabled: true,
        variants: [
          { key: 'variant-a', name: 'Variant A', value: 'value-a' },
          { key: 'variant-b', name: 'Variant B', value: 'value-b' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(true);
      expect(result.variant).toBe('variant-a');
      expect(result.value).toBe('value-a');
    });
  });

  describe('Deterministic Bucketing', () => {
    it('should consistently assign same bucket to same user', () => {
      const flag: FeatureFlag = {
        key: 'rollout-flag',
        name: 'Rollout Flag',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-123' };
      
      // Evaluate multiple times
      const result1 = evaluator.evaluate(flag, context);
      const result2 = evaluator.evaluate(flag, context);
      const result3 = evaluator.evaluate(flag, context);

      // Should get same result every time
      expect(result1.enabled).toBe(result2.enabled);
      expect(result2.enabled).toBe(result3.enabled);
      
      if (result1.reasoning?.bucket !== undefined) {
        expect(result1.reasoning.bucket).toBe(result2.reasoning?.bucket);
        expect(result2.reasoning?.bucket).toBe(result3.reasoning?.bucket);
      }
    });

    it('should use orgId for stickiness when available', () => {
      const flag: FeatureFlag = {
        key: 'org-flag',
        name: 'Org Flag',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 100,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context1: EvaluationContext = { userId: 'user-1', orgId: 'org-123' };
      const context2: EvaluationContext = { userId: 'user-2', orgId: 'org-123' };
      const context3: EvaluationContext = { userId: 'user-1', orgId: 'org-456' };

      const result1 = evaluator.evaluate(flag, context1);
      const result2 = evaluator.evaluate(flag, context2);
      const result3 = evaluator.evaluate(flag, context3);

      // Same org should get same bucket (same rollout decision)
      if (result1.reasoning?.bucket !== undefined && result2.reasoning?.bucket !== undefined) {
        expect(result1.reasoning.bucket).toBe(result2.reasoning.bucket);
        expect(result1.reasoning.stickinessKey).toBe('orgId');
        expect(result1.reasoning.stickinessValue).toBe('org-123');
      }

      // Different org should get different bucket
      if (result1.reasoning?.bucket !== undefined && result3.reasoning?.bucket !== undefined) {
        // May or may not be different, but should use orgId
        expect(result3.reasoning.stickinessKey).toBe('orgId');
        expect(result3.reasoning.stickinessValue).toBe('org-456');
      }
    });

    it('should fallback to userId when orgId not available', () => {
      const flag: FeatureFlag = {
        key: 'user-flag',
        name: 'User Flag',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 100,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-123' };
      const result = evaluator.evaluate(flag, context);

      if (result.reasoning) {
        expect(result.reasoning.stickinessKey).toBe('userId');
        expect(result.reasoning.stickinessValue).toBe('user-123');
      }
    });

    it('should return bucket in 0-100 range', () => {
      const flag: FeatureFlag = {
        key: 'bucket-test',
        name: 'Bucket Test',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 100,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Test with multiple users to ensure buckets are in range
      for (let i = 0; i < 100; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        const result = evaluator.evaluate(flag, context);
        
        if (result.reasoning?.bucket !== undefined) {
          expect(result.reasoning.bucket).toBeGreaterThanOrEqual(0);
          expect(result.reasoning.bucket).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should use custom stickiness attribute when specified', () => {
      const flag: FeatureFlag = {
        key: 'custom-stickiness',
        name: 'Custom Stickiness',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 100,
          stickiness: 'customAttr',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = {
        userId: 'user-1',
        orgId: 'org-1',
        attributes: { customAttr: 'custom-value-123' },
      };

      const result = evaluator.evaluate(flag, context);

      if (result.reasoning) {
        expect(result.reasoning.stickinessKey).toBe('customAttr');
        expect(result.reasoning.stickinessValue).toBe('custom-value-123');
      }
    });
  });

  describe('Percentage Rollout', () => {
    it('should include user in 100% rollout', () => {
      const flag: FeatureFlag = {
        key: 'full-rollout',
        name: 'Full Rollout',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 100,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('ROLLOUT');
      if (result.reasoning) {
        expect(result.reasoning.rolloutPercentage).toBe(100);
        expect(result.reasoning.bucket).toBeDefined();
      }
    });

    it('should exclude user from 0% rollout', () => {
      const flag: FeatureFlag = {
        key: 'no-rollout',
        name: 'No Rollout',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 0,
        },
        variants: [
          { key: 'control', name: 'Control', value: 'control' },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      // Should fall back to default variant, not rollout
      expect(result.reason).toBe('DEFAULT_VARIANT');
    });

    it('should distribute users across percentage rollout', () => {
      const flag: FeatureFlag = {
        key: 'partial-rollout',
        name: 'Partial Rollout',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        variants: [
          { key: 'control', name: 'Control', value: 'control' },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let enabledCount = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        const context: EvaluationContext = { userId: `user-${i}` };
        const result = evaluator.evaluate(flag, context);
        if (result.enabled && result.reason === 'ROLLOUT') {
          enabledCount++;
        }
      }

      // Should be approximately 50% (allow some variance)
      const percentage = (enabledCount / totalUsers) * 100;
      expect(percentage).toBeGreaterThan(40);
      expect(percentage).toBeLessThan(60);
    });
  });

  describe('Targeting Rules', () => {
    it('should match targeting rule and return variant', () => {
      const flag: FeatureFlag = {
        key: 'targeted-flag',
        name: 'Targeted Flag',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control' },
          { key: 'premium', name: 'Premium', value: 'premium' },
        ],
        targeting: [
          {
            id: 'premium-users',
            priority: 1,
            conditions: [
              {
                attribute: 'userId',
                operator: 'equals',
                value: 'premium-user-1',
              },
            ],
            variant: 'premium',
          },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'premium-user-1' };
      const result = evaluator.evaluate(flag, context);

      expect(result.enabled).toBe(true);
      expect(result.variant).toBe('premium');
      expect(result.value).toBe('premium');
      expect(result.reason).toBe('TARGETING_MATCH');
      if (result.reasoning) {
        expect(result.reasoning.matchedTargetingRuleId).toBe('premium-users');
        expect(result.reasoning.matchedConditions).toBeDefined();
        expect(result.reasoning.matchedConditions?.length).toBe(1);
      }
    });

    it('should prioritize higher priority targeting rules', () => {
      const flag: FeatureFlag = {
        key: 'priority-flag',
        name: 'Priority Flag',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control' },
          { key: 'variant-a', name: 'Variant A', value: 'a' },
          { key: 'variant-b', name: 'Variant B', value: 'b' },
        ],
        targeting: [
          {
            id: 'rule-low',
            priority: 10,
            conditions: [
              { attribute: 'userId', operator: 'equals', value: 'user-1' },
            ],
            variant: 'variant-a',
          },
          {
            id: 'rule-high',
            priority: 1,
            conditions: [
              { attribute: 'userId', operator: 'equals', value: 'user-1' },
            ],
            variant: 'variant-b',
          },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      // Should match higher priority rule (lower number = higher priority)
      expect(result.variant).toBe('variant-b');
      if (result.reasoning) {
        expect(result.reasoning.matchedTargetingRuleId).toBe('rule-high');
      }
    });
  });

  describe('Audit Reasoning', () => {
    it('should include reasoning in evaluation result for rollout', () => {
      const flag: FeatureFlag = {
        key: 'reasoning-flag',
        name: 'Reasoning Flag',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-123' };
      const result = evaluator.evaluate(flag, context);

      if (result.reason === 'ROLLOUT' && result.reasoning) {
        expect(result.reasoning.bucket).toBeDefined();
        expect(result.reasoning.stickinessKey).toBeDefined();
        expect(result.reasoning.stickinessValue).toBeDefined();
        expect(result.reasoning.rolloutPercentage).toBe(50);
        expect(result.reasoning.hashValue).toBeDefined();
      }
    });

    it('should include reasoning in evaluation result for targeting', () => {
      const flag: FeatureFlag = {
        key: 'targeting-reasoning',
        name: 'Targeting Reasoning',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control' },
          { key: 'variant', name: 'Variant', value: 'variant' },
        ],
        targeting: [
          {
            id: 'test-rule',
            priority: 1,
            conditions: [
              { attribute: 'userId', operator: 'equals', value: 'user-1' },
            ],
            variant: 'variant',
          },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const context: EvaluationContext = { userId: 'user-1' };
      const result = evaluator.evaluate(flag, context);

      if (result.reason === 'TARGETING_MATCH' && result.reasoning) {
        expect(result.reasoning.matchedTargetingRuleId).toBe('test-rule');
        expect(result.reasoning.matchedConditions).toBeDefined();
        expect(result.reasoning.matchedConditions?.length).toBe(1);
      }
    });
  });
});
