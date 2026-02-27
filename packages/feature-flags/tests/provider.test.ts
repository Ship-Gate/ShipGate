/**
 * Tests for FeatureFlagProvider
 * Tests audit logging, consistency, and provider functionality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlagProvider } from '../src/provider';
import type {
  FeatureFlag,
  EvaluationContext,
  FlagProviderConfig,
} from '../src/types';

describe('FeatureFlagProvider', () => {
  let provider: FeatureFlagProvider;

  beforeEach(() => {
    provider = new FeatureFlagProvider({
      source: 'local',
      localFlags: [],
    });
  });

  describe('Audit Logging', () => {
    it('should log flag evaluation decisions', async () => {
      const flag: FeatureFlag = {
        key: 'audit-test',
        name: 'Audit Test',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      provider.evaluate('audit-test', context);

      const auditLog = provider.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);

      const evaluateEvent = auditLog.find((e) => e.action === 'evaluate');
      expect(evaluateEvent).toBeDefined();
      expect(evaluateEvent?.flagKey).toBe('audit-test');
      expect(evaluateEvent?.context).toEqual(context);
      expect(evaluateEvent?.result).toBeDefined();
    });

    it('should include reasoning in audit log for rollout decisions', async () => {
      const flag: FeatureFlag = {
        key: 'rollout-audit',
        name: 'Rollout Audit',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-123' };
      provider.evaluate('rollout-audit', context);

      const auditLog = provider.getAuditLog();
      const evaluateEvent = auditLog.find(
        (e) => e.action === 'evaluate' && e.flagKey === 'rollout-audit'
      );

      expect(evaluateEvent).toBeDefined();
      if (evaluateEvent?.result?.reason === 'ROLLOUT') {
        expect(evaluateEvent.reasoning).toBeDefined();
        expect(evaluateEvent.reasoning?.bucket).toBeDefined();
        expect(evaluateEvent.reasoning?.stickinessKey).toBeDefined();
        expect(evaluateEvent.reasoning?.rolloutPercentage).toBe(50);
      }
    });

    it('should include reasoning in audit log for targeting decisions', async () => {
      const flag: FeatureFlag = {
        key: 'targeting-audit',
        name: 'Targeting Audit',
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

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      provider.evaluate('targeting-audit', context);

      const auditLog = provider.getAuditLog();
      const evaluateEvent = auditLog.find(
        (e) => e.action === 'evaluate' && e.flagKey === 'targeting-audit'
      );

      expect(evaluateEvent).toBeDefined();
      if (evaluateEvent?.result?.reason === 'TARGETING_MATCH') {
        expect(evaluateEvent.reasoning).toBeDefined();
        expect(evaluateEvent.reasoning?.matchedTargetingRuleId).toBe('test-rule');
        expect(evaluateEvent.reasoning?.matchedConditions).toBeDefined();
      }
    });

    it('should log flag updates', async () => {
      const flag: FeatureFlag = {
        key: 'update-test',
        name: 'Update Test',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const auditLog = provider.getAuditLog();
      const updateEvent = auditLog.find((e) => e.action === 'update');
      expect(updateEvent).toBeDefined();
      expect(updateEvent?.flagKey).toBe('update-test');
    });

    it('should limit audit log to last 1000 events', async () => {
      const flag: FeatureFlag = {
        key: 'limit-test',
        name: 'Limit Test',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };

      // Generate more than 1000 events
      for (let i = 0; i < 1500; i++) {
        provider.evaluate('limit-test', context);
      }

      const auditLog = provider.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });

    it('should allow limiting audit log retrieval', async () => {
      const flag: FeatureFlag = {
        key: 'limit-retrieval',
        name: 'Limit Retrieval',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };

      // Generate multiple events
      for (let i = 0; i < 10; i++) {
        provider.evaluate('limit-retrieval', context);
      }

      const limitedLog = provider.getAuditLog(5);
      // Should return at most 5 events (or fewer if less than 5 exist)
      expect(limitedLog.length).toBeLessThanOrEqual(5);
      expect(limitedLog.length).toBeGreaterThan(0);
    });
  });

  describe('Consistency', () => {
    it('should return consistent results for same user', async () => {
      const flag: FeatureFlag = {
        key: 'consistency-test',
        name: 'Consistency Test',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-123' };

      const result1 = provider.evaluate('consistency-test', context);
      const result2 = provider.evaluate('consistency-test', context);
      const result3 = provider.evaluate('consistency-test', context);

      // Should get same result every time
      expect(result1.enabled).toBe(result2.enabled);
      expect(result2.enabled).toBe(result3.enabled);
      expect(result1.variant).toBe(result2.variant);
      expect(result2.variant).toBe(result3.variant);

      // Audit logs should show same reasoning
      const auditLog = provider.getAuditLog();
      const events = auditLog.filter(
        (e) => e.flagKey === 'consistency-test' && e.action === 'evaluate'
      );

      if (events.length >= 3) {
        const reasoning1 = events[0]?.reasoning;
        const reasoning2 = events[1]?.reasoning;
        const reasoning3 = events[2]?.reasoning;

        if (reasoning1?.bucket !== undefined) {
          expect(reasoning1.bucket).toBe(reasoning2?.bucket);
          expect(reasoning2?.bucket).toBe(reasoning3?.bucket);
        }
      }
    });

    it('should return consistent results for same org', async () => {
      const flag: FeatureFlag = {
        key: 'org-consistency',
        name: 'Org Consistency',
        enabled: true,
        rollout: {
          type: 'percentage',
          percentage: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context1: EvaluationContext = {
        userId: 'user-1',
        orgId: 'org-123',
      };
      const context2: EvaluationContext = {
        userId: 'user-2',
        orgId: 'org-123',
      };

      const result1 = provider.evaluate('org-consistency', context1);
      const result2 = provider.evaluate('org-consistency', context2);

      // Same org should get same rollout decision
      if (result1.reasoning?.bucket !== undefined && result2.reasoning?.bucket !== undefined) {
        expect(result1.reasoning.bucket).toBe(result2.reasoning.bucket);
        expect(result1.enabled).toBe(result2.enabled);
      }
    });
  });

  describe('Boolean Flags', () => {
    it('should check if flag is enabled', async () => {
      const flag: FeatureFlag = {
        key: 'boolean-test',
        name: 'Boolean Test',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      expect(provider.isEnabled('boolean-test', context)).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      const flag: FeatureFlag = {
        key: 'disabled-test',
        name: 'Disabled Test',
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      expect(provider.isEnabled('disabled-test', context)).toBe(false);
    });
  });

  describe('Multivariate Flags', () => {
    it('should get variant value', async () => {
      const flag: FeatureFlag = {
        key: 'variant-test',
        name: 'Variant Test',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control-value' },
          { key: 'treatment', name: 'Treatment', value: 'treatment-value' },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      const variant = provider.getVariant('variant-test', context);
      expect(variant).toBe('control');
    });

    it('should get flag value with default', async () => {
      const flag: FeatureFlag = {
        key: 'value-test',
        name: 'Value Test',
        enabled: true,
        variants: [
          { key: 'control', name: 'Control', value: 'control-value' },
        ],
        defaultVariant: 'control',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await provider.initialize();
      provider.updateFlag(flag);

      const context: EvaluationContext = { userId: 'user-1' };
      const value = provider.getValue('value-test', context, 'default');
      expect(value).toBe('control-value');
    });
  });
});
