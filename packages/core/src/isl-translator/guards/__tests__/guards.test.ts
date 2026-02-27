/**
 * Tests for LLM Guards
 *
 * All tests use fake clocks for deterministic behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFakeClock,
  TIME,
  type FakeClock,
  type GuardEvent,
} from '../guardTypes.js';
import { createRateGuard, RateGuardPresets } from '../rateGuard.js';
import { createBudgetGuard, BudgetGuardPresets } from '../budgetGuard.js';
import { createCombinedGuard, CombinedGuardPresets } from '../index.js';

describe('RateGuard', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock(0);
  });

  describe('createRateGuard', () => {
    it('should allow requests within limit', () => {
      const guard = createRateGuard({ maxRequests: 3, clock });

      expect(guard.check().allowed).toBe(true);
      guard.record();
      expect(guard.check().allowed).toBe(true);
      guard.record();
      expect(guard.check().allowed).toBe(true);
      guard.record();
    });

    it('should block requests when limit exceeded', () => {
      const guard = createRateGuard({ maxRequests: 2, clock });

      guard.record();
      guard.record();

      const result = guard.check();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
      expect(result.retryAfterMs).toBeDefined();
    });

    it('should allow requests after window expires', () => {
      const guard = createRateGuard({
        maxRequests: 2,
        windowMs: TIME.MINUTE,
        clock,
      });

      guard.record();
      guard.record();
      expect(guard.check().allowed).toBe(false);

      // Advance past the window
      clock.advance(TIME.MINUTE + 1);

      expect(guard.check().allowed).toBe(true);
    });

    it('should provide accurate usage statistics', () => {
      const guard = createRateGuard({ maxRequests: 5, clock });

      guard.record();
      guard.record();

      const usage = guard.getUsage();
      expect(usage.current).toBe(2);
      expect(usage.limit).toBe(5);
      expect(usage.percentUsed).toBe(40);
    });

    it('should calculate correct retry time', () => {
      const guard = createRateGuard({
        maxRequests: 1,
        windowMs: 10000,
        clock,
      });

      clock.set(1000); // Start at 1 second
      guard.record();

      clock.advance(5000); // Now at 6 seconds

      const result = guard.check();
      expect(result.allowed).toBe(false);
      // Should need to wait until timestamp 1000 + 10000 = 11000
      // Current time is 6000, so wait 5000ms
      expect(result.retryAfterMs).toBe(5000);
    });

    it('should reset state', () => {
      const guard = createRateGuard({ maxRequests: 1, clock });

      guard.record();
      expect(guard.check().allowed).toBe(false);

      guard.reset();
      expect(guard.check().allowed).toBe(true);
    });

    it('should emit events', () => {
      const guard = createRateGuard({ maxRequests: 1, clock });
      const events: GuardEvent[] = [];
      guard.onEvent((e) => events.push(e));

      guard.check();
      guard.record();
      guard.check();

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'request_allowed')).toBe(true);
      expect(events.some((e) => e.type === 'request_recorded')).toBe(true);
      expect(events.some((e) => e.type === 'rate_limited')).toBe(true);
    });

    it('should throw on invalid config', () => {
      expect(() => createRateGuard({ maxRequests: 0, clock })).toThrow();
      expect(() => createRateGuard({ maxRequests: -1, clock })).toThrow();
      expect(() =>
        createRateGuard({ maxRequests: 1, windowMs: 0, clock })
      ).toThrow();
    });
  });

  describe('RateGuardPresets', () => {
    it('should create conservative guard (5/min)', () => {
      const guard = RateGuardPresets.conservative(clock);
      for (let i = 0; i < 5; i++) {
        expect(guard.check().allowed).toBe(true);
        guard.record();
      }
      expect(guard.check().allowed).toBe(false);
    });

    it('should create standard guard (20/min)', () => {
      const guard = RateGuardPresets.standard(clock);
      expect(guard.getUsage().limit).toBe(20);
    });

    it('should create aggressive guard (60/min)', () => {
      const guard = RateGuardPresets.aggressive(clock);
      expect(guard.getUsage().limit).toBe(60);
    });
  });
});

describe('BudgetGuard', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock(0);
  });

  describe('createBudgetGuard', () => {
    it('should allow requests within token budget', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 1000,
        clock,
      });

      const result = guard.check({ inputTokens: 100, outputTokens: 100 });
      expect(result.allowed).toBe(true);
    });

    it('should block requests exceeding token budget', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 100,
        clock,
      });

      // Record some usage first
      guard.record({ inputTokens: 80, outputTokens: 0 });

      // This would exceed the budget
      const result = guard.check({ inputTokens: 50, outputTokens: 0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Token budget exceeded');
    });

    it('should hard stop when enabled', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 100,
        hardStop: true,
        clock,
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });
      expect(guard.isHardStopped()).toBe(true);

      // Any subsequent request should be blocked
      const result = guard.check({ inputTokens: 1, outputTokens: 0 });
      expect(result.allowed).toBe(false);
      expect(result.hardStopped).toBe(true);
    });

    it('should not hard stop when disabled', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 100,
        hardStop: false,
        clock,
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });
      expect(guard.isHardStopped()).toBe(false);
    });

    it('should track cost correctly', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 10000,
        inputTokenCostPer1k: 0.10, // 10 cents per 1k
        outputTokenCostPer1k: 0.20, // 20 cents per 1k
        clock,
      });

      guard.record({ inputTokens: 1000, outputTokens: 1000 });

      const usage = guard.getUsage();
      // 1000 input tokens = 0.10 cents, 1000 output tokens = 0.20 cents
      expect(usage.costCents).toBeCloseTo(0.30);
    });

    it('should block when cost budget exceeded', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 1_000_000,
        maxCostCentsPerDay: 10, // 10 cents
        inputTokenCostPer1k: 1.0, // 1 cent per 1k
        outputTokenCostPer1k: 2.0, // 2 cents per 1k
        clock,
      });

      // Use 8 cents worth
      guard.record({ inputTokens: 4000, outputTokens: 2000 });

      // Try to use 5 more cents (would exceed 10 cent limit)
      const result = guard.check({ inputTokens: 3000, outputTokens: 1000 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cost budget exceeded');
    });

    it('should reset on new day', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 100,
        hardStop: true,
        clock,
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });
      expect(guard.isHardStopped()).toBe(true);

      // Advance to next day
      clock.advance(TIME.DAY);

      expect(guard.isHardStopped()).toBe(false);
      expect(guard.getUsage().tokensUsed).toBe(0);
      expect(guard.check().allowed).toBe(true);
    });

    it('should provide accurate usage statistics', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 1000,
        clock,
      });

      guard.record({ inputTokens: 200, outputTokens: 300 });

      const usage = guard.getUsage();
      expect(usage.tokensUsed).toBe(500);
      expect(usage.tokenLimit).toBe(1000);
      expect(usage.percentUsed).toBe(50);
    });

    it('should emit warning at 80% threshold', () => {
      const guard = createBudgetGuard({
        maxTokensPerDay: 100,
        clock,
      });

      const events: GuardEvent[] = [];
      guard.onEvent((e) => events.push(e));

      guard.record({ inputTokens: 80, outputTokens: 0 });

      expect(events.some((e) => e.type === 'warning_threshold')).toBe(true);
    });

    it('should throw on invalid config', () => {
      expect(() =>
        createBudgetGuard({ maxTokensPerDay: 0, clock })
      ).toThrow();
      expect(() =>
        createBudgetGuard({ maxTokensPerDay: -1, clock })
      ).toThrow();
      expect(() =>
        createBudgetGuard({
          maxTokensPerDay: 1000,
          maxCostCentsPerDay: 0,
          clock,
        })
      ).toThrow();
    });
  });

  describe('BudgetGuardPresets', () => {
    it('should create development guard (10k tokens)', () => {
      const guard = BudgetGuardPresets.development(clock);
      expect(guard.getUsage().tokenLimit).toBe(10_000);
    });

    it('should create standard guard (100k tokens)', () => {
      const guard = BudgetGuardPresets.standard(clock);
      expect(guard.getUsage().tokenLimit).toBe(100_000);
    });

    it('should create production guard (1M tokens)', () => {
      const guard = BudgetGuardPresets.production(clock);
      expect(guard.getUsage().tokenLimit).toBe(1_000_000);
    });

    it('should create cost-capped guard', () => {
      const guard = BudgetGuardPresets.costCapped(50, clock);
      expect(guard.getUsage().costLimitCents).toBe(50);
    });
  });
});

describe('CombinedGuard', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock(0);
  });

  describe('createCombinedGuard', () => {
    it('should pass when both guards allow', () => {
      const guard = createCombinedGuard({
        rate: { maxRequests: 10, clock },
        budget: { maxTokensPerDay: 10000, clock },
      });

      const result = guard.check({ inputTokens: 100, outputTokens: 0 });
      expect(result.allowed).toBe(true);
      expect(result.rateResult.allowed).toBe(true);
      expect(result.budgetResult.allowed).toBe(true);
    });

    it('should fail when rate guard blocks', () => {
      const guard = createCombinedGuard({
        rate: { maxRequests: 1, clock },
        budget: { maxTokensPerDay: 10000, clock },
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });

      const result = guard.check({ inputTokens: 100, outputTokens: 0 });
      expect(result.allowed).toBe(false);
      expect(result.rateResult.allowed).toBe(false);
      expect(result.budgetResult.allowed).toBe(true);
      expect(result.reason).toContain('Rate limit');
    });

    it('should fail when budget guard blocks', () => {
      const guard = createCombinedGuard({
        rate: { maxRequests: 100, clock },
        budget: { maxTokensPerDay: 100, clock },
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });

      const result = guard.check({ inputTokens: 100, outputTokens: 0 });
      expect(result.allowed).toBe(false);
      expect(result.rateResult.allowed).toBe(true);
      expect(result.budgetResult.allowed).toBe(false);
      expect(result.reason).toContain('budget');
    });

    it('should record usage on both guards', () => {
      const guard = createCombinedGuard({
        rate: { maxRequests: 10, clock },
        budget: { maxTokensPerDay: 1000, clock },
      });

      guard.record({ inputTokens: 100, outputTokens: 50 });

      const usage = guard.getUsage();
      expect(usage.rate.current).toBe(1);
      expect(usage.budget.tokensUsed).toBe(150);
    });

    it('should reset both guards', () => {
      const guard = createCombinedGuard({
        rate: { maxRequests: 1, clock },
        budget: { maxTokensPerDay: 100, clock },
      });

      guard.record({ inputTokens: 100, outputTokens: 0 });
      expect(guard.check().allowed).toBe(false);

      guard.reset();

      expect(guard.check().allowed).toBe(true);
    });
  });

  describe('CombinedGuardPresets', () => {
    it('should create development preset', () => {
      const guard = CombinedGuardPresets.development(clock);
      const usage = guard.getUsage();
      expect(usage.rate.limit).toBe(5);
      expect(usage.budget.tokenLimit).toBe(10_000);
    });

    it('should create standard preset', () => {
      const guard = CombinedGuardPresets.standard(clock);
      const usage = guard.getUsage();
      expect(usage.rate.limit).toBe(20);
      expect(usage.budget.tokenLimit).toBe(100_000);
    });

    it('should create production preset', () => {
      const guard = CombinedGuardPresets.production(clock);
      const usage = guard.getUsage();
      expect(usage.rate.limit).toBe(60);
      expect(usage.budget.tokenLimit).toBe(1_000_000);
    });
  });
});

describe('FakeClock', () => {
  it('should start at initial time', () => {
    const clock = createFakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it('should advance time', () => {
    const clock = createFakeClock(0);
    clock.advance(5000);
    expect(clock.now()).toBe(5000);
    clock.advance(1000);
    expect(clock.now()).toBe(6000);
  });

  it('should set time directly', () => {
    const clock = createFakeClock(0);
    clock.set(10000);
    expect(clock.now()).toBe(10000);
  });
});

describe('Integration scenarios', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock(0);
  });

  it('should handle realistic LLM workflow', () => {
    const guard = createCombinedGuard({
      rate: { maxRequests: 10, windowMs: TIME.MINUTE, clock },
      budget: { maxTokensPerDay: 50000, hardStop: true, clock },
    });

    // Simulate 5 LLM calls
    for (let i = 0; i < 5; i++) {
      const check = guard.check({ inputTokens: 500, outputTokens: 1000 });
      expect(check.allowed).toBe(true);
      guard.record({ inputTokens: 500, outputTokens: 1000 });
    }

    // 5 calls * 1500 tokens = 7500 tokens used
    expect(guard.getUsage().budget.tokensUsed).toBe(7500);
    expect(guard.getUsage().rate.current).toBe(5);

    // Advance time past rate window
    clock.advance(TIME.MINUTE + 1);

    // Rate should reset, budget should persist
    expect(guard.getUsage().rate.current).toBe(0);
    expect(guard.getUsage().budget.tokensUsed).toBe(7500);
  });

  it('should block when daily budget exhausted', () => {
    const guard = createBudgetGuard({
      maxTokensPerDay: 1000,
      hardStop: true,
      clock,
    });

    // Use all tokens
    guard.record({ inputTokens: 500, outputTokens: 500 });
    expect(guard.isHardStopped()).toBe(true);

    // Any further request should fail
    const result = guard.check({ inputTokens: 1, outputTokens: 0 });
    expect(result.allowed).toBe(false);
    expect(result.hardStopped).toBe(true);

    // Next day should reset
    clock.advance(TIME.DAY);
    expect(guard.isHardStopped()).toBe(false);
    expect(guard.check().allowed).toBe(true);
  });

  it('should handle burst traffic then cool down', () => {
    const guard = createRateGuard({
      maxRequests: 5,
      windowMs: 10 * TIME.SECOND,
      clock,
    });

    // Burst 5 requests
    for (let i = 0; i < 5; i++) {
      expect(guard.check().allowed).toBe(true);
      guard.record();
    }

    // 6th request blocked
    const blocked = guard.check();
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(10 * TIME.SECOND);

    // Wait for cooldown
    clock.advance(10 * TIME.SECOND + 1);

    // Can make requests again
    expect(guard.check().allowed).toBe(true);
  });
});
