/**
 * Budget Guard - Token and cost limiting for LLM calls
 *
 * Implements daily token/cost budgets with optional hard stop
 * when limits are exceeded.
 */

import type {
  Clock,
  BudgetGuard,
  BudgetGuardConfig,
  BudgetGuardResult,
  BudgetUsage,
  TokenUsage,
  GuardEvent,
  GuardEventListener,
} from './guardTypes.js';

import { realClock, TIME } from './guardTypes.js';

/**
 * Default token costs (GPT-4 pricing as baseline)
 */
const DEFAULT_INPUT_COST_PER_1K = 0.15; // cents
const DEFAULT_OUTPUT_COST_PER_1K = 0.60; // cents

/**
 * Warning threshold percentage (emit warning at 80% usage)
 */
const WARNING_THRESHOLD_PERCENT = 80;

/**
 * Create a budget guard with the given configuration
 *
 * @param config - Budget guard configuration
 * @returns BudgetGuard instance
 *
 * @example
 * ```typescript
 * // Allow 100k tokens per day with hard stop
 * const guard = createBudgetGuard({
 *   maxTokensPerDay: 100_000,
 *   hardStop: true,
 * });
 *
 * // Check before making a request
 * const result = guard.check({ inputTokens: 500, outputTokens: 0 });
 * if (result.allowed) {
 *   const response = await makeLLMCall();
 *   guard.record({ inputTokens: 500, outputTokens: response.tokens });
 * }
 * ```
 */
export function createBudgetGuard(config: BudgetGuardConfig): BudgetGuard & {
  onEvent(listener: GuardEventListener): () => void;
} {
  const {
    maxTokensPerDay,
    maxCostCentsPerDay,
    inputTokenCostPer1k = DEFAULT_INPUT_COST_PER_1K,
    outputTokenCostPer1k = DEFAULT_OUTPUT_COST_PER_1K,
    hardStop = true,
    clock = realClock,
  } = config;

  // Validate config
  if (maxTokensPerDay <= 0) {
    throw new Error('maxTokensPerDay must be positive');
  }
  if (maxCostCentsPerDay !== undefined && maxCostCentsPerDay <= 0) {
    throw new Error('maxCostCentsPerDay must be positive');
  }

  // Daily usage tracking
  let tokensUsedToday = 0;
  let costCentsToday = 0;
  let dayStartTimestamp = getDayStart(clock.now());
  let isHardStopped = false;
  let warningEmitted = false;
  let listeners: GuardEventListener[] = [];

  function getDayStart(timestamp: number): number {
    // Round down to start of day (midnight UTC)
    return Math.floor(timestamp / TIME.DAY) * TIME.DAY;
  }

  function emit(event: Omit<GuardEvent, 'timestamp' | 'guardType'>): void {
    const fullEvent: GuardEvent = {
      ...event,
      timestamp: clock.now(),
      guardType: 'budget',
    };
    for (const listener of listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Ignore listener errors
      }
    }
  }

  function checkDayRollover(): void {
    const currentDayStart = getDayStart(clock.now());
    if (currentDayStart > dayStartTimestamp) {
      // New day - reset counters
      tokensUsedToday = 0;
      costCentsToday = 0;
      dayStartTimestamp = currentDayStart;
      isHardStopped = false;
      warningEmitted = false;
    }
  }

  function calculateCost(usage: TokenUsage): number {
    const inputCost = (usage.inputTokens / 1000) * inputTokenCostPer1k;
    const outputCost = (usage.outputTokens / 1000) * outputTokenCostPer1k;
    return inputCost + outputCost;
  }

  function getTotalTokens(usage: TokenUsage): number {
    return usage.inputTokens + usage.outputTokens;
  }

  function getEndOfDay(): number {
    return dayStartTimestamp + TIME.DAY;
  }

  function buildUsage(): BudgetUsage {
    const percentUsed = (tokensUsedToday / maxTokensPerDay) * 100;
    return {
      current: tokensUsedToday,
      limit: maxTokensPerDay,
      resetsAt: getEndOfDay(),
      percentUsed,
      tokensUsed: tokensUsedToday,
      costCents: costCentsToday,
      tokenLimit: maxTokensPerDay,
      costLimitCents: maxCostCentsPerDay,
    };
  }

  function checkWarningThreshold(): void {
    if (warningEmitted) return;

    const percentUsed = (tokensUsedToday / maxTokensPerDay) * 100;
    if (percentUsed >= WARNING_THRESHOLD_PERCENT) {
      warningEmitted = true;
      emit({
        type: 'warning_threshold',
        details: {
          percentUsed,
          tokensUsed: tokensUsedToday,
          tokenLimit: maxTokensPerDay,
          threshold: WARNING_THRESHOLD_PERCENT,
        },
      });
    }
  }

  return {
    check(estimatedTokens?: TokenUsage): BudgetGuardResult {
      checkDayRollover();

      // If hard stopped, block all requests
      if (isHardStopped) {
        return {
          allowed: false,
          reason: 'Hard stop active: daily budget exceeded',
          hardStopped: true,
          budgetUsage: buildUsage(),
          retryAfterMs: getEndOfDay() - clock.now(),
        };
      }

      const estimatedTotal = estimatedTokens
        ? getTotalTokens(estimatedTokens)
        : 0;
      const projectedTokens = tokensUsedToday + estimatedTotal;

      // Check token limit
      if (projectedTokens > maxTokensPerDay) {
        const overBy = projectedTokens - maxTokensPerDay;

        emit({
          type: 'budget_exceeded',
          details: {
            tokensUsed: tokensUsedToday,
            estimatedTokens: estimatedTotal,
            projectedTokens,
            maxTokensPerDay,
            overBy,
          },
        });

        if (hardStop) {
          isHardStopped = true;
          emit({
            type: 'hard_stop',
            details: {
              tokensUsed: tokensUsedToday,
              maxTokensPerDay,
            },
          });
        }

        return {
          allowed: false,
          reason: `Token budget exceeded: ${projectedTokens}/${maxTokensPerDay} tokens`,
          hardStopped: hardStop,
          budgetUsage: buildUsage(),
          retryAfterMs: getEndOfDay() - clock.now(),
        };
      }

      // Check cost limit (if configured)
      if (maxCostCentsPerDay !== undefined && estimatedTokens) {
        const estimatedCost = calculateCost(estimatedTokens);
        const projectedCost = costCentsToday + estimatedCost;

        if (projectedCost > maxCostCentsPerDay) {
          emit({
            type: 'budget_exceeded',
            details: {
              costCents: costCentsToday,
              estimatedCost,
              projectedCost,
              maxCostCentsPerDay,
            },
          });

          if (hardStop) {
            isHardStopped = true;
            emit({
              type: 'hard_stop',
              details: {
                costCents: costCentsToday,
                maxCostCentsPerDay,
              },
            });
          }

          return {
            allowed: false,
            reason: `Cost budget exceeded: ${projectedCost.toFixed(2)}¢/${maxCostCentsPerDay}¢`,
            hardStopped: hardStop,
            budgetUsage: buildUsage(),
            retryAfterMs: getEndOfDay() - clock.now(),
          };
        }
      }

      emit({
        type: 'request_allowed',
        details: {
          tokensUsed: tokensUsedToday,
          tokenLimit: maxTokensPerDay,
          remaining: maxTokensPerDay - tokensUsedToday,
        },
      });

      return {
        allowed: true,
        budgetUsage: buildUsage(),
      };
    },

    record(usage: TokenUsage): void {
      checkDayRollover();

      const tokens = getTotalTokens(usage);
      const cost = calculateCost(usage);

      tokensUsedToday += tokens;
      costCentsToday += cost;

      emit({
        type: 'request_recorded',
        details: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: tokens,
          cost,
          tokensUsedToday,
          costCentsToday,
        },
      });

      checkWarningThreshold();

      // Check if we've now exceeded limits
      if (tokensUsedToday >= maxTokensPerDay && hardStop) {
        isHardStopped = true;
        emit({
          type: 'hard_stop',
          details: {
            tokensUsed: tokensUsedToday,
            maxTokensPerDay,
          },
        });
      }
    },

    getUsage(): BudgetUsage {
      checkDayRollover();
      return buildUsage();
    },

    reset(): void {
      tokensUsedToday = 0;
      costCentsToday = 0;
      dayStartTimestamp = getDayStart(clock.now());
      isHardStopped = false;
      warningEmitted = false;
    },

    isHardStopped(): boolean {
      checkDayRollover();
      return isHardStopped;
    },

    onEvent(listener: GuardEventListener): () => void {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
}

/**
 * Pre-configured budget guards for common use cases
 */
export const BudgetGuardPresets = {
  /** Development: 10k tokens/day, $0.10 cost limit */
  development: (clock?: Clock) =>
    createBudgetGuard({
      maxTokensPerDay: 10_000,
      maxCostCentsPerDay: 10, // 10 cents
      hardStop: true,
      clock,
    }),

  /** Standard: 100k tokens/day, $1.00 cost limit */
  standard: (clock?: Clock) =>
    createBudgetGuard({
      maxTokensPerDay: 100_000,
      maxCostCentsPerDay: 100, // $1.00
      hardStop: true,
      clock,
    }),

  /** Production: 1M tokens/day, $10 cost limit */
  production: (clock?: Clock) =>
    createBudgetGuard({
      maxTokensPerDay: 1_000_000,
      maxCostCentsPerDay: 1000, // $10.00
      hardStop: false, // Allow overrun with warnings
      clock,
    }),

  /** Unlimited tokens with cost cap */
  costCapped: (maxCostCents: number, clock?: Clock) =>
    createBudgetGuard({
      maxTokensPerDay: Number.MAX_SAFE_INTEGER,
      maxCostCentsPerDay: maxCostCents,
      hardStop: true,
      clock,
    }),
} as const;
