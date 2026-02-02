/**
 * Feature Flag Evaluator
 */
import type {
  FeatureFlag,
  EvaluationContext,
  EvaluationResult,
  TargetingRule,
  Condition,
  RolloutConfig,
} from './types';
import murmurhash from 'murmurhash';

export class FlagEvaluator {
  /**
   * Evaluate a feature flag for a given context
   */
  evaluate(flag: FeatureFlag, context: EvaluationContext): EvaluationResult {
    // Check if flag is disabled
    if (!flag.enabled) {
      return {
        flagKey: flag.key,
        enabled: false,
        reason: 'FLAG_DISABLED',
      };
    }

    // Check expiration
    if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
      return {
        flagKey: flag.key,
        enabled: false,
        reason: 'FLAG_DISABLED',
      };
    }

    // Evaluate targeting rules
    if (flag.targeting && flag.targeting.length > 0) {
      const targetingResult = this.evaluateTargeting(flag, context);
      if (targetingResult) {
        return targetingResult;
      }
    }

    // Evaluate rollout
    if (flag.rollout) {
      const rolloutResult = this.evaluateRollout(flag, context);
      if (rolloutResult) {
        return rolloutResult;
      }
    }

    // Return default variant
    if (flag.variants && flag.variants.length > 0) {
      const defaultVariant = flag.variants.find(v => v.key === flag.defaultVariant) 
        ?? flag.variants[0]!;
      
      return {
        flagKey: flag.key,
        enabled: true,
        variant: defaultVariant.key,
        value: defaultVariant.value,
        reason: 'DEFAULT_VARIANT',
        metadata: defaultVariant.payload,
      };
    }

    return {
      flagKey: flag.key,
      enabled: true,
      reason: 'DEFAULT_VARIANT',
    };
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargeting(
    flag: FeatureFlag,
    context: EvaluationContext
  ): EvaluationResult | null {
    // Sort by priority (lower = higher priority)
    const sortedRules = [...(flag.targeting ?? [])].sort(
      (a, b) => a.priority - b.priority
    );

    for (const rule of sortedRules) {
      if (this.matchesRule(rule, context)) {
        const variant = flag.variants?.find(v => v.key === rule.variant);
        return {
          flagKey: flag.key,
          enabled: true,
          variant: rule.variant,
          value: variant?.value,
          reason: 'TARGETING_MATCH',
          metadata: { ruleId: rule.id, ...variant?.payload },
        };
      }
    }

    return null;
  }

  /**
   * Check if context matches a targeting rule
   */
  private matchesRule(rule: TargetingRule, context: EvaluationContext): boolean {
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if context matches a single condition
   */
  private matchesCondition(condition: Condition, context: EvaluationContext): boolean {
    const value = this.getAttributeValue(condition.attribute, context);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'notEquals':
        return value !== condition.value;

      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value));

      case 'notContains':
        return typeof value === 'string' && !value.includes(String(condition.value));

      case 'startsWith':
        return typeof value === 'string' && value.startsWith(String(condition.value));

      case 'endsWith':
        return typeof value === 'string' && value.endsWith(String(condition.value));

      case 'matches':
        return typeof value === 'string' && new RegExp(String(condition.value)).test(value);

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'notIn':
        return Array.isArray(condition.value) && !condition.value.includes(value);

      case 'greaterThan':
        return typeof value === 'number' && value > (condition.value as number);

      case 'lessThan':
        return typeof value === 'number' && value < (condition.value as number);

      case 'greaterThanOrEqual':
        return typeof value === 'number' && value >= (condition.value as number);

      case 'lessThanOrEqual':
        return typeof value === 'number' && value <= (condition.value as number);

      case 'before':
        return new Date(value as string) < new Date(condition.value as string);

      case 'after':
        return new Date(value as string) > new Date(condition.value as string);

      case 'semverEquals':
        return this.compareSemver(value as string, condition.value as string) === 0;

      case 'semverGreaterThan':
        return this.compareSemver(value as string, condition.value as string) > 0;

      case 'semverLessThan':
        return this.compareSemver(value as string, condition.value as string) < 0;

      default:
        return false;
    }
  }

  /**
   * Get attribute value from context
   */
  private getAttributeValue(attribute: string, context: EvaluationContext): unknown {
    // Handle built-in attributes
    switch (attribute) {
      case 'userId':
        return context.userId;
      case 'sessionId':
        return context.sessionId;
      case 'environment':
        return context.environment;
      case 'timestamp':
        return context.timestamp ?? Date.now();
    }

    // Handle nested attributes
    if (attribute.includes('.')) {
      const parts = attribute.split('.');
      let value: unknown = context.attributes;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      return value;
    }

    return context.attributes?.[attribute];
  }

  /**
   * Evaluate rollout configuration
   */
  private evaluateRollout(
    flag: FeatureFlag,
    context: EvaluationContext
  ): EvaluationResult | null {
    const rollout = flag.rollout!;
    let percentage: number;

    switch (rollout.type) {
      case 'percentage':
        percentage = rollout.percentage ?? 0;
        break;

      case 'gradual':
        percentage = this.calculateGradualPercentage(rollout);
        break;

      case 'scheduled':
        percentage = this.calculateScheduledPercentage(rollout);
        break;

      default:
        return null;
    }

    // Calculate hash for deterministic bucketing
    const stickinessKey = rollout.stickiness ?? 'userId';
    const stickinessValue = this.getAttributeValue(stickinessKey, context);
    const bucket = this.getBucket(flag.key, String(stickinessValue ?? ''));

    if (bucket < percentage) {
      // User is in the rollout
      if (flag.variants && flag.variants.length > 0) {
        const variant = this.selectVariantByWeight(flag.variants, bucket);
        return {
          flagKey: flag.key,
          enabled: true,
          variant: variant.key,
          value: variant.value,
          reason: 'ROLLOUT',
          metadata: { percentage, bucket, ...variant.payload },
        };
      }

      return {
        flagKey: flag.key,
        enabled: true,
        reason: 'ROLLOUT',
        metadata: { percentage, bucket },
      };
    }

    return null;
  }

  /**
   * Calculate percentage for gradual rollout
   */
  private calculateGradualPercentage(rollout: RolloutConfig): number {
    if (!rollout.schedule) return 0;

    const now = Date.now();
    const start = new Date(rollout.schedule.startAt).getTime();
    const end = rollout.schedule.endAt 
      ? new Date(rollout.schedule.endAt).getTime()
      : start + 7 * 24 * 60 * 60 * 1000; // Default 7 days

    if (now < start) return rollout.schedule.startPercentage;
    if (now > end) return rollout.schedule.endPercentage;

    const progress = (now - start) / (end - start);
    const range = rollout.schedule.endPercentage - rollout.schedule.startPercentage;
    return rollout.schedule.startPercentage + (progress * range);
  }

  /**
   * Calculate percentage for scheduled rollout
   */
  private calculateScheduledPercentage(rollout: RolloutConfig): number {
    if (!rollout.schedule) return 0;

    const now = new Date();
    const start = new Date(rollout.schedule.startAt);

    if (now < start) return 0;
    if (rollout.schedule.endAt && now > new Date(rollout.schedule.endAt)) {
      return 0;
    }

    return rollout.schedule.endPercentage;
  }

  /**
   * Get deterministic bucket (0-100) for a user
   */
  private getBucket(flagKey: string, userId: string): number {
    const hash = murmurhash.v3(`${flagKey}:${userId}`);
    return (hash % 100);
  }

  /**
   * Select variant based on weights
   */
  private selectVariantByWeight(
    variants: { key: string; weight?: number; value: unknown; payload?: Record<string, unknown> }[],
    bucket: number
  ): { key: string; value: unknown; payload?: Record<string, unknown> } {
    // Normalize weights
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);
    const normalizedBucket = (bucket / 100) * totalWeight;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight ?? 1;
      if (normalizedBucket < cumulative) {
        return variant;
      }
    }

    // This is safe because selectVariantByWeight is only called when variants.length > 0
    return variants[variants.length - 1]!;
  }

  /**
   * Compare semantic versions
   */
  private compareSemver(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const numA = partsA[i] ?? 0;
      const numB = partsB[i] ?? 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }
}
