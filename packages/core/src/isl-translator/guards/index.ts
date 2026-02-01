/**
 * LLM Guards - Rate and Budget Control
 *
 * Provides guards for controlling LLM API usage:
 * - Rate limiting (requests per time window)
 * - Budget limiting (tokens/cost per day)
 * - Combined guards for comprehensive control
 */

export * from './guardTypes.js';
export * from './rateGuard.js';
export * from './budgetGuard.js';

import type {
  Clock,
  CombinedGuard,
  CombinedGuardResult,
  CombinedUsage,
  TokenUsage,
  RateGuardConfig,
  BudgetGuardConfig,
} from './guardTypes.js';

import { createRateGuard } from './rateGuard.js';
import { createBudgetGuard } from './budgetGuard.js';

/**
 * Configuration for combined guard
 */
export interface CombinedGuardConfig {
  /** Rate guard configuration */
  readonly rate: RateGuardConfig;

  /** Budget guard configuration */
  readonly budget: BudgetGuardConfig;
}

/**
 * Create a combined guard that checks both rate and budget limits
 *
 * @param config - Combined guard configuration
 * @returns CombinedGuard instance
 *
 * @example
 * ```typescript
 * const guard = createCombinedGuard({
 *   rate: { maxRequests: 20 },
 *   budget: { maxTokensPerDay: 100_000 },
 * });
 *
 * const result = guard.check({ inputTokens: 500, outputTokens: 0 });
 * if (result.allowed) {
 *   const response = await makeLLMCall();
 *   guard.record({ inputTokens: 500, outputTokens: response.tokens });
 * }
 * ```
 */
export function createCombinedGuard(config: CombinedGuardConfig): CombinedGuard {
  const rateGuard = createRateGuard(config.rate);
  const budgetGuard = createBudgetGuard(config.budget);

  return {
    check(estimatedTokens?: TokenUsage): CombinedGuardResult {
      const rateResult = rateGuard.check();
      const budgetResult = budgetGuard.check(estimatedTokens);

      // Both must pass
      const allowed = rateResult.allowed && budgetResult.allowed;

      let reason: string | undefined;
      if (!rateResult.allowed) {
        reason = rateResult.reason;
      } else if (!budgetResult.allowed) {
        reason = budgetResult.reason;
      }

      return {
        allowed,
        rateResult,
        budgetResult,
        reason,
      };
    },

    record(usage: TokenUsage): void {
      rateGuard.record();
      budgetGuard.record(usage);
    },

    getUsage(): CombinedUsage {
      return {
        rate: rateGuard.getUsage(),
        budget: budgetGuard.getUsage(),
      };
    },

    reset(): void {
      rateGuard.reset();
      budgetGuard.reset();
    },
  };
}

/**
 * Pre-configured combined guards for common use cases
 */
export const CombinedGuardPresets = {
  /** Development: 5 req/min, 10k tokens/day */
  development: (clock?: Clock) =>
    createCombinedGuard({
      rate: { maxRequests: 5, clock },
      budget: { maxTokensPerDay: 10_000, hardStop: true, clock },
    }),

  /** Standard: 20 req/min, 100k tokens/day */
  standard: (clock?: Clock) =>
    createCombinedGuard({
      rate: { maxRequests: 20, clock },
      budget: { maxTokensPerDay: 100_000, hardStop: true, clock },
    }),

  /** Production: 60 req/min, 1M tokens/day (soft limit) */
  production: (clock?: Clock) =>
    createCombinedGuard({
      rate: { maxRequests: 60, clock },
      budget: { maxTokensPerDay: 1_000_000, hardStop: false, clock },
    }),
} as const;
