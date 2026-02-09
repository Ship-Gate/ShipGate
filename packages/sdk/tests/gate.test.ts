import { describe, it, expect } from 'vitest';
import { decideGate } from '../src/gate.js';
import type { VerifyResult } from '../src/types.js';

// ============================================================================
// Helper to build VerifyResult fixtures
// ============================================================================

function makeResult(overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    verdict: 'SHIP',
    score: 95,
    passed: true,
    summary: 'All checks passed',
    reasons: [],
    suggestions: [],
    durationMs: 100,
    ...overrides,
  };
}

// ============================================================================
// decideGate
// ============================================================================

describe('decideGate', () => {
  it('returns SHIP when passed is true and score ≥ 80', () => {
    const result = makeResult({ passed: true, score: 95 });
    expect(decideGate(result)).toBe('SHIP');
  });

  it('returns SHIP at exactly the 80 threshold', () => {
    const result = makeResult({ passed: true, score: 80 });
    expect(decideGate(result)).toBe('SHIP');
  });

  it('returns WARN when score is between 50 and 79 (not passed)', () => {
    const result = makeResult({ passed: false, score: 65, verdict: 'WARN' });
    expect(decideGate(result)).toBe('WARN');
  });

  it('returns WARN at exactly the 50 threshold', () => {
    const result = makeResult({ passed: false, score: 50, verdict: 'WARN' });
    expect(decideGate(result)).toBe('WARN');
  });

  it('returns NO_SHIP when score is below 50', () => {
    const result = makeResult({
      passed: false,
      score: 30,
      verdict: 'NO_SHIP',
    });
    expect(decideGate(result)).toBe('NO_SHIP');
  });

  it('returns NO_SHIP when there is a critical reason, even with high score', () => {
    const result = makeResult({
      passed: true,
      score: 99,
      verdict: 'SHIP',
      reasons: [{ label: 'Hardcoded secret detected', impact: 'critical' }],
    });
    expect(decideGate(result)).toBe('NO_SHIP');
  });

  it('returns SHIP when reasons are non-critical and score is high', () => {
    const result = makeResult({
      passed: true,
      score: 90,
      verdict: 'SHIP',
      reasons: [{ label: 'Minor style issue', impact: 'low' }],
    });
    expect(decideGate(result)).toBe('SHIP');
  });

  it('is deterministic — same input always produces same output', () => {
    const result = makeResult({ passed: false, score: 60, verdict: 'WARN' });

    const first = decideGate(result);
    const second = decideGate(result);
    const third = decideGate(result);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).toBe('WARN');
  });

  it('returns NO_SHIP for zero score', () => {
    const result = makeResult({
      passed: false,
      score: 0,
      verdict: 'NO_SHIP',
    });
    expect(decideGate(result)).toBe('NO_SHIP');
  });

  it('returns WARN when passed is false but score is high', () => {
    // Edge case: high score but not explicitly passed
    const result = makeResult({ passed: false, score: 85, verdict: 'WARN' });
    expect(decideGate(result)).toBe('WARN');
  });
});
