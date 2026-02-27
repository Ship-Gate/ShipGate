/**
 * Guard Types for LLM Cost/Rate Control
 *
 * Provides type definitions for rate limiting and budget guards.
 * All guards are designed to be deterministic and testable via injectable clocks.
 */

/**
 * Clock interface for deterministic time handling.
 * Inject a fake clock in tests for reproducible behavior.
 */
export interface Clock {
  /** Returns current timestamp in milliseconds */
  now(): number;
}

/**
 * Real clock implementation using Date.now()
 */
export const realClock: Clock = {
  now: () => Date.now(),
};

/**
 * Create a fake clock for testing
 */
export function createFakeClock(initialTime: number = 0): FakeClock {
  let currentTime = initialTime;
  return {
    now: () => currentTime,
    advance: (ms: number) => {
      currentTime += ms;
    },
    set: (ms: number) => {
      currentTime = ms;
    },
  };
}

/**
 * Fake clock with time manipulation methods
 */
export interface FakeClock extends Clock {
  /** Advance time by given milliseconds */
  advance(ms: number): void;
  /** Set time to specific timestamp */
  set(ms: number): void;
}

/**
 * Result of a guard check
 */
export interface GuardResult {
  /** Whether the request is allowed */
  readonly allowed: boolean;

  /** Reason for denial (if not allowed) */
  readonly reason?: string;

  /** How long to wait before retry (ms), if rate limited */
  readonly retryAfterMs?: number;

  /** Current usage stats */
  readonly usage?: GuardUsage;
}

/**
 * Usage statistics from a guard
 */
export interface GuardUsage {
  /** Current count in the window */
  readonly current: number;

  /** Maximum allowed in the window */
  readonly limit: number;

  /** When the current window resets (timestamp ms) */
  readonly resetsAt: number;

  /** Percentage of limit used (0-100) */
  readonly percentUsed: number;
}

/**
 * Configuration for rate limiting
 */
export interface RateGuardConfig {
  /** Maximum requests allowed per window */
  readonly maxRequests: number;

  /** Window size in milliseconds (default: 60000 = 1 minute) */
  readonly windowMs?: number;

  /** Optional clock for testing (default: realClock) */
  readonly clock?: Clock;
}

/**
 * Configuration for budget/token limiting
 */
export interface BudgetGuardConfig {
  /** Maximum tokens allowed per day */
  readonly maxTokensPerDay: number;

  /** Maximum cost in cents per day (optional) */
  readonly maxCostCentsPerDay?: number;

  /** Cost per 1000 input tokens in cents (default: 0.15 for GPT-4) */
  readonly inputTokenCostPer1k?: number;

  /** Cost per 1000 output tokens in cents (default: 0.60 for GPT-4) */
  readonly outputTokenCostPer1k?: number;

  /** Hard stop - completely block when exceeded (default: true) */
  readonly hardStop?: boolean;

  /** Optional clock for testing (default: realClock) */
  readonly clock?: Clock;
}

/**
 * Token usage for a single LLM call
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  readonly inputTokens: number;

  /** Output/completion tokens */
  readonly outputTokens: number;
}

/**
 * Budget usage statistics
 */
export interface BudgetUsage extends GuardUsage {
  /** Total tokens used today */
  readonly tokensUsed: number;

  /** Total cost in cents today */
  readonly costCents: number;

  /** Token limit */
  readonly tokenLimit: number;

  /** Cost limit in cents (if set) */
  readonly costLimitCents?: number;
}

/**
 * Result of a budget guard check
 */
export interface BudgetGuardResult extends GuardResult {
  /** Budget-specific usage stats */
  readonly budgetUsage?: BudgetUsage;

  /** Whether hard stop is active */
  readonly hardStopped?: boolean;
}

/**
 * Interface for rate guard
 */
export interface RateGuard {
  /** Check if a request is allowed */
  check(): GuardResult;

  /** Record a request (call after successful check) */
  record(): void;

  /** Get current usage statistics */
  getUsage(): GuardUsage;

  /** Reset the guard state */
  reset(): void;
}

/**
 * Interface for budget guard
 */
export interface BudgetGuard {
  /** Check if a request with estimated tokens is allowed */
  check(estimatedTokens?: TokenUsage): BudgetGuardResult;

  /** Record actual token usage after a call */
  record(usage: TokenUsage): void;

  /** Get current budget usage statistics */
  getUsage(): BudgetUsage;

  /** Reset the guard state (start new day) */
  reset(): void;

  /** Check if hard stopped */
  isHardStopped(): boolean;
}

/**
 * Combined guard that checks both rate and budget
 */
export interface CombinedGuard {
  /** Check both rate and budget guards */
  check(estimatedTokens?: TokenUsage): CombinedGuardResult;

  /** Record usage on both guards */
  record(usage: TokenUsage): void;

  /** Get combined usage statistics */
  getUsage(): CombinedUsage;

  /** Reset both guards */
  reset(): void;
}

/**
 * Result from combined guard check
 */
export interface CombinedGuardResult {
  readonly allowed: boolean;
  readonly rateResult: GuardResult;
  readonly budgetResult: BudgetGuardResult;
  readonly reason?: string;
}

/**
 * Combined usage statistics
 */
export interface CombinedUsage {
  readonly rate: GuardUsage;
  readonly budget: BudgetUsage;
}

/**
 * Guard event types for logging/monitoring
 */
export type GuardEventType =
  | 'rate_limited'
  | 'budget_exceeded'
  | 'hard_stop'
  | 'warning_threshold'
  | 'request_allowed'
  | 'request_recorded';

/**
 * Guard event for monitoring
 */
export interface GuardEvent {
  readonly type: GuardEventType;
  readonly timestamp: number;
  readonly guardType: 'rate' | 'budget' | 'combined';
  readonly details?: Record<string, unknown>;
}

/**
 * Event listener for guard events
 */
export type GuardEventListener = (event: GuardEvent) => void;

/**
 * Time constants for convenience
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;
