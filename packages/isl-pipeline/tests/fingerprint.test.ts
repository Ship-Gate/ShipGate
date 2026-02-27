/**
 * Tests for Stable Fingerprint and Stuck Detection
 * 
 * These tests verify:
 * 1. Fingerprint stability across runs (same violations → same fingerprint)
 * 2. Order independence (different ordering produces same fingerprint)
 * 3. Sensitivity to changes (different messages produce different fingerprints)
 * 4. Stuck detection logic
 * 
 * @module @isl-lang/pipeline/tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  stableFingerprint,
  normalizeMessage,
  normalizeSpan,
  FingerprintTracker,
  fingerprintsEqual,
  hasViolationsChanged,
  violationsDiffSummary,
  type ViolationLike,
} from '../src/fingerprint.js';

// ============================================================================
// Test Data
// ============================================================================

const violation1: ViolationLike = {
  ruleId: 'intent/rate-limit-required',
  file: 'src/api/route.ts',
  message: 'Missing rate limit enforcement',
  line: 10,
};

const violation2: ViolationLike = {
  ruleId: 'intent/audit-required',
  file: 'src/api/route.ts',
  message: 'Audit call missing on error path',
  line: 25,
};

const violation3: ViolationLike = {
  ruleId: 'pii/console-in-production',
  file: 'src/utils/logger.ts',
  message: 'console.log in production code',
  line: 15,
};

// ============================================================================
// Message Normalization Tests
// ============================================================================

describe('normalizeMessage', () => {
  it('collapses multiple whitespace to single space', () => {
    expect(normalizeMessage('hello    world')).toBe('hello world');
    expect(normalizeMessage('hello\n\nworld')).toBe('hello world');
    expect(normalizeMessage('hello\t\tworld')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeMessage('  hello world  ')).toBe('hello world');
    expect(normalizeMessage('\nhello world\n')).toBe('hello world');
  });

  it('lowercases the message', () => {
    expect(normalizeMessage('HELLO World')).toBe('hello world');
    expect(normalizeMessage('Error: MISSING Rate Limit')).toBe('error: missing rate limit');
  });

  it('replaces UUIDs with placeholder', () => {
    expect(normalizeMessage('Request 550e8400-e29b-41d4-a716-446655440000 failed'))
      .toBe('request <uuid> failed');
    expect(normalizeMessage('ID: 123e4567-e89b-12d3-a456-426614174000'))
      .toBe('id: <uuid>');
  });

  it('replaces timestamps with placeholder', () => {
    expect(normalizeMessage('Error at 2024-01-15T10:30:00Z'))
      .toBe('error at <timestamp>');
    expect(normalizeMessage('Created: 2024-01-15 10:30:00'))
      .toBe('created: <timestamp>');
    expect(normalizeMessage('Time: 2024-01-15T10:30:00.123+05:00'))
      .toBe('time: <timestamp>');
  });

  it('replaces line/column references with placeholder', () => {
    expect(normalizeMessage('Error on line 42'))
      .toBe('error on line <n>');
    expect(normalizeMessage('at column 15'))
      .toBe('at column <n>');
    expect(normalizeMessage('Line 10, Column 5'))
      .toBe('line <n>, column <n>');
  });
});

// ============================================================================
// Span Normalization Tests
// ============================================================================

describe('normalizeSpan', () => {
  it('returns empty string for undefined line', () => {
    expect(normalizeSpan(undefined)).toBe('');
  });

  it('formats line only', () => {
    expect(normalizeSpan(10)).toBe('L10');
  });

  it('formats line and column', () => {
    expect(normalizeSpan(10, 5)).toBe('L10:C5');
  });

  it('formats full range', () => {
    expect(normalizeSpan(10, 5, 15, 20)).toBe('L10:C5-L15:C20');
  });

  it('omits endLine if same as line', () => {
    expect(normalizeSpan(10, 5, 10, 20)).toBe('L10:C5');
  });

  it('formats range without columns', () => {
    expect(normalizeSpan(10, undefined, 15)).toBe('L10-L15');
  });
});

// ============================================================================
// Stable Fingerprint Tests
// ============================================================================

describe('stableFingerprint', () => {
  describe('basic functionality', () => {
    it('produces consistent output for same input', () => {
      const violations = [violation1, violation2];
      const fp1 = stableFingerprint(violations);
      const fp2 = stableFingerprint(violations);
      expect(fp1).toBe(fp2);
    });

    it('produces empty fingerprint for empty violations', () => {
      const fp = stableFingerprint([]);
      expect(fp).toBe('0000000000000000');
    });

    it('returns hex string of expected length', () => {
      const fp = stableFingerprint([violation1]);
      expect(fp).toMatch(/^[0-9a-f]{16}$/);
    });

    it('respects custom output length', () => {
      const fp = stableFingerprint([violation1], { outputLength: 32 });
      expect(fp).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('order independence', () => {
    it('produces same fingerprint for different orderings', () => {
      const order1 = [violation1, violation2, violation3];
      const order2 = [violation3, violation1, violation2];
      const order3 = [violation2, violation3, violation1];

      const fp1 = stableFingerprint(order1);
      const fp2 = stableFingerprint(order2);
      const fp3 = stableFingerprint(order3);

      expect(fp1).toBe(fp2);
      expect(fp2).toBe(fp3);
    });

    it('produces same fingerprint with duplicates in different positions', () => {
      const order1 = [violation1, violation1, violation2];
      const order2 = [violation1, violation2, violation1];
      const order3 = [violation2, violation1, violation1];

      const fp1 = stableFingerprint(order1);
      const fp2 = stableFingerprint(order2);
      const fp3 = stableFingerprint(order3);

      expect(fp1).toBe(fp2);
      expect(fp2).toBe(fp3);
    });
  });

  describe('sensitivity to changes', () => {
    it('produces different fingerprint for different messages', () => {
      const v1: ViolationLike = { ...violation1, message: 'Error A' };
      const v2: ViolationLike = { ...violation1, message: 'Error B' };

      const fp1 = stableFingerprint([v1]);
      const fp2 = stableFingerprint([v2]);

      expect(fp1).not.toBe(fp2);
    });

    it('produces different fingerprint for different files', () => {
      const v1: ViolationLike = { ...violation1, file: 'file1.ts' };
      const v2: ViolationLike = { ...violation1, file: 'file2.ts' };

      const fp1 = stableFingerprint([v1]);
      const fp2 = stableFingerprint([v2]);

      expect(fp1).not.toBe(fp2);
    });

    it('produces different fingerprint for different ruleIds', () => {
      const v1: ViolationLike = { ...violation1, ruleId: 'rule1' };
      const v2: ViolationLike = { ...violation1, ruleId: 'rule2' };

      const fp1 = stableFingerprint([v1]);
      const fp2 = stableFingerprint([v2]);

      expect(fp1).not.toBe(fp2);
    });

    it('produces different fingerprint for different line numbers', () => {
      const v1: ViolationLike = { ...violation1, line: 10 };
      const v2: ViolationLike = { ...violation1, line: 20 };

      const fp1 = stableFingerprint([v1]);
      const fp2 = stableFingerprint([v2]);

      expect(fp1).not.toBe(fp2);
    });

    it('produces same fingerprint for equivalent normalized messages', () => {
      const v1: ViolationLike = { ...violation1, message: 'Error at line 10' };
      const v2: ViolationLike = { ...violation1, message: 'error at line 20' };

      // Both normalize to "error at line <n>"
      const fp1 = stableFingerprint([v1], { normalizeWhitespace: true });
      const fp2 = stableFingerprint([v2], { normalizeWhitespace: true });

      expect(fp1).toBe(fp2);
    });
  });

  describe('options', () => {
    it('can exclude message from fingerprint', () => {
      const v1: ViolationLike = { ...violation1, message: 'Error A' };
      const v2: ViolationLike = { ...violation1, message: 'Error B' };

      const fp1 = stableFingerprint([v1], { includeMessage: false });
      const fp2 = stableFingerprint([v2], { includeMessage: false });

      expect(fp1).toBe(fp2);
    });

    it('can exclude span from fingerprint', () => {
      const v1: ViolationLike = { ...violation1, line: 10 };
      const v2: ViolationLike = { ...violation1, line: 20 };

      const fp1 = stableFingerprint([v1], { includeSpan: false });
      const fp2 = stableFingerprint([v2], { includeSpan: false });

      expect(fp1).toBe(fp2);
    });

    it('can disable message normalization', () => {
      const v1: ViolationLike = { ...violation1, message: 'Error' };
      const v2: ViolationLike = { ...violation1, message: 'error' };

      const fp1 = stableFingerprint([v1], { normalizeWhitespace: false });
      const fp2 = stableFingerprint([v2], { normalizeWhitespace: false });

      // Without normalization, case difference matters
      expect(fp1).not.toBe(fp2);
    });
  });
});

// ============================================================================
// FingerprintTracker Tests
// ============================================================================

describe('FingerprintTracker', () => {
  let tracker: FingerprintTracker;

  beforeEach(() => {
    tracker = new FingerprintTracker({
      repeatThreshold: 2,
      maxIterations: 5,
    });
  });

  describe('basic tracking', () => {
    it('tracks fingerprints and counts', () => {
      tracker.record('fp1');
      expect(tracker.getCount('fp1')).toBe(1);
      expect(tracker.hasSeen('fp1')).toBe(true);
      expect(tracker.hasSeen('fp2')).toBe(false);
    });

    it('increments count on repeat', () => {
      tracker.record('fp1');
      tracker.record('fp1');
      expect(tracker.getCount('fp1')).toBe(2);
    });

    it('tracks iteration history', () => {
      tracker.record('fp1');
      tracker.record('fp2');
      tracker.record('fp1');
      expect(tracker.getHistory()).toEqual(['fp1', 'fp2', 'fp1']);
      expect(tracker.getIterationCount()).toBe(3);
    });

    it('tracks unique fingerprints', () => {
      tracker.record('fp1');
      tracker.record('fp2');
      tracker.record('fp1');
      expect(tracker.getUniqueCount()).toBe(2);
    });
  });

  describe('stuck detection', () => {
    it('detects stuck when fingerprint repeats N times', () => {
      const result1 = tracker.record('fp1');
      expect(result1.shouldAbort).toBe(false);

      const result2 = tracker.record('fp1');
      expect(result2.shouldAbort).toBe(true);
      expect(result2.reason).toBe('stuck');
      expect(result2.details).toContain('repeated 2 times');
    });

    it('does not abort on non-consecutive repeats under threshold', () => {
      tracker.record('fp1');
      tracker.record('fp2');
      const result = tracker.record('fp1');
      // fp1 appeared twice now, triggers stuck
      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toBe('stuck');
    });
  });

  describe('max iterations', () => {
    it('aborts when max iterations exceeded', () => {
      for (let i = 0; i < 5; i++) {
        const result = tracker.record(`fp${i}`);
        expect(result.shouldAbort).toBe(false);
      }
      const result = tracker.record('fp5');
      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toBe('max_iterations');
    });
  });

  describe('oscillation detection', () => {
    it('detects oscillating pattern (A→B→A→B)', () => {
      // Use higher threshold to avoid stuck detection triggering first
      const oscillationTracker = new FingerprintTracker({
        repeatThreshold: 5, // High threshold so stuck doesn't trigger
        maxIterations: 10,
      });
      oscillationTracker.record('fpA');
      oscillationTracker.record('fpB');
      oscillationTracker.record('fpA');
      const result = oscillationTracker.record('fpB');
      expect(result.shouldAbort).toBe(true);
      expect(result.reason).toBe('oscillating');
    });

    it('does not trigger oscillation for same fingerprint', () => {
      const t = new FingerprintTracker({
        repeatThreshold: 5, // High threshold to avoid stuck detection
        maxIterations: 10,
      });
      t.record('fpA');
      t.record('fpA');
      t.record('fpA');
      const result = t.record('fpA');
      // Same fingerprint is not oscillation, it's stuck (but threshold is high)
      expect(result.reason).not.toBe('oscillating');
    });
  });

  describe('summary', () => {
    it('provides accurate summary', () => {
      tracker.record('fp1');
      tracker.record('fp2');
      tracker.record('fp1');

      const summary = tracker.getSummary();
      expect(summary.iterations).toBe(3);
      expect(summary.uniqueFingerprints).toBe(2);
      expect(summary.mostCommon?.fingerprint).toBe('fp1');
      expect(summary.mostCommon?.count).toBe(2);
      expect(summary.isStuck).toBe(true);
    });

    it('returns null mostCommon for empty tracker', () => {
      const summary = tracker.getSummary();
      expect(summary.mostCommon).toBe(null);
      expect(summary.isStuck).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      tracker.record('fp1');
      tracker.record('fp2');
      tracker.reset();

      expect(tracker.getIterationCount()).toBe(0);
      expect(tracker.getUniqueCount()).toBe(0);
      expect(tracker.hasSeen('fp1')).toBe(false);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('fingerprintsEqual', () => {
  it('returns true for equal fingerprints', () => {
    expect(fingerprintsEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different fingerprints', () => {
    expect(fingerprintsEqual('abc123', 'xyz789')).toBe(false);
  });
});

describe('hasViolationsChanged', () => {
  it('detects when violations changed', () => {
    const violations = [violation1];
    const fp = stableFingerprint(violations);

    const newViolations = [violation1, violation2];
    expect(hasViolationsChanged(newViolations, fp)).toBe(true);
  });

  it('detects when violations unchanged', () => {
    const violations = [violation1, violation2];
    const fp = stableFingerprint(violations);

    // Same violations, different order
    const sameViolations = [violation2, violation1];
    expect(hasViolationsChanged(sameViolations, fp)).toBe(false);
  });
});

describe('violationsDiffSummary', () => {
  it('identifies added violations', () => {
    const before = [violation1];
    const after = [violation1, violation2];

    const diff = violationsDiffSummary(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].ruleId).toBe(violation2.ruleId);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });

  it('identifies removed violations', () => {
    const before = [violation1, violation2];
    const after = [violation1];

    const diff = violationsDiffSummary(before, after);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].ruleId).toBe(violation2.ruleId);
    expect(diff.unchanged).toBe(1);
  });

  it('handles complete replacement', () => {
    const before = [violation1];
    const after = [violation2];

    const diff = violationsDiffSummary(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.unchanged).toBe(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration: healer stuck detection scenario', () => {
  it('simulates healing loop that gets stuck', () => {
    const tracker = new FingerprintTracker({
      repeatThreshold: 3,
      maxIterations: 10,
    });

    // Simulate violations that don't change after fixes
    const stuckViolations: ViolationLike[] = [
      { ruleId: 'unknown/rule', file: 'app.ts', message: 'Cannot fix automatically', line: 1 },
    ];
    const stuckFp = stableFingerprint(stuckViolations);

    // Iteration 1
    let result = tracker.record(stuckFp);
    expect(result.shouldAbort).toBe(false);

    // Iteration 2
    result = tracker.record(stuckFp);
    expect(result.shouldAbort).toBe(false);

    // Iteration 3 - should be stuck
    result = tracker.record(stuckFp);
    expect(result.shouldAbort).toBe(true);
    expect(result.reason).toBe('stuck');
  });

  it('simulates successful healing progression', () => {
    const tracker = new FingerprintTracker({
      repeatThreshold: 2,
      maxIterations: 10,
    });

    // Iteration 1: Multiple violations
    const v1 = stableFingerprint([violation1, violation2, violation3]);
    expect(tracker.record(v1).shouldAbort).toBe(false);

    // Iteration 2: Some violations fixed
    const v2 = stableFingerprint([violation2, violation3]);
    expect(tracker.record(v2).shouldAbort).toBe(false);

    // Iteration 3: More progress
    const v3 = stableFingerprint([violation3]);
    expect(tracker.record(v3).shouldAbort).toBe(false);

    // Iteration 4: All fixed (empty)
    const v4 = stableFingerprint([]);
    expect(tracker.record(v4).shouldAbort).toBe(false);

    // All unique fingerprints, no stuck
    expect(tracker.getUniqueCount()).toBe(4);
    expect(tracker.getSummary().isStuck).toBe(false);
  });
});
