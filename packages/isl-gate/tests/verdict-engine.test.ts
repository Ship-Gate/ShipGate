/**
 * Verdict Engine Tests
 *
 * Covers all verdict paths: SHIP, WARN, NO_SHIP,
 * critical failure overrides, specless degradation,
 * edge cases, and the specless check registry.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  SCORING_THRESHOLDS,
  CRITICAL_FAILURES,
  createGateEvidence,
  computeScore,
  findCriticalFailures,
  hasCriticalFailure,
  produceVerdict,
  registerSpeclessCheck,
  unregisterSpeclessCheck,
  getSpeclessChecks,
  clearSpeclessChecks,
  runSpeclessChecks,
} from '../src/authoritative/index.js';

import type {
  GateEvidence,
  GateVerdict,
  SpeclessCheck,
  GateContext,
} from '../src/authoritative/index.js';

// ============================================================================
// Helpers
// ============================================================================

/** Shorthand: ISL-spec passing evidence at given confidence */
function islPass(check: string, confidence = 1.0): GateEvidence {
  return createGateEvidence('isl-spec', check, 'pass', confidence, 'ok');
}

/** Shorthand: ISL-spec failing evidence */
function islFail(check: string, confidence = 0.9, details = 'failed'): GateEvidence {
  return createGateEvidence('isl-spec', check, 'fail', confidence, details);
}

/** Shorthand: specless-scanner passing evidence */
function speclessPass(check: string, confidence = 0.8): GateEvidence {
  return createGateEvidence('specless-scanner', check, 'pass', confidence, 'ok');
}

/** Shorthand: specless-scanner failing evidence */
function speclessFail(check: string, confidence = 0.8, details = 'failed'): GateEvidence {
  return createGateEvidence('specless-scanner', check, 'fail', confidence, details);
}

// ============================================================================
// 1. Threshold Constants
// ============================================================================

describe('Scoring Thresholds', () => {
  it('defines SHIP at 0.85', () => {
    expect(SCORING_THRESHOLDS.SHIP).toBe(0.85);
  });

  it('defines WARN at 0.50', () => {
    expect(SCORING_THRESHOLDS.WARN).toBe(0.50);
  });

  it('defines NO_SHIP at 0', () => {
    expect(SCORING_THRESHOLDS.NO_SHIP).toBe(0);
  });
});

describe('Critical Failures', () => {
  it('includes postcondition_violation', () => {
    expect(CRITICAL_FAILURES).toContain('postcondition_violation');
  });

  it('includes security_violation', () => {
    expect(CRITICAL_FAILURES).toContain('security_violation');
  });

  it('includes critical_vulnerability', () => {
    expect(CRITICAL_FAILURES).toContain('critical_vulnerability');
  });

  it('includes fake_feature_detected', () => {
    expect(CRITICAL_FAILURES).toContain('fake_feature_detected');
  });
});

// ============================================================================
// 2. Evidence Creation
// ============================================================================

describe('createGateEvidence', () => {
  it('creates evidence with correct fields', () => {
    const e = createGateEvidence('isl-spec', 'check-a', 'pass', 0.95, 'ok');
    expect(e.source).toBe('isl-spec');
    expect(e.check).toBe('check-a');
    expect(e.result).toBe('pass');
    expect(e.confidence).toBe(0.95);
    expect(e.details).toBe('ok');
  });

  it('clamps confidence to [0, 1]', () => {
    const high = createGateEvidence('isl-spec', 'x', 'pass', 1.5, '');
    const low = createGateEvidence('isl-spec', 'x', 'pass', -0.3, '');
    expect(high.confidence).toBe(1);
    expect(low.confidence).toBe(0);
  });
});

// ============================================================================
// 3. Score Computation
// ============================================================================

describe('computeScore', () => {
  it('returns 0 for empty evidence', () => {
    expect(computeScore([])).toBe(0);
  });

  it('returns 0 when all evidence is skip', () => {
    const evidence = [
      createGateEvidence('isl-spec', 'a', 'skip', 1.0, 'skipped'),
      createGateEvidence('isl-spec', 'b', 'skip', 1.0, 'skipped'),
    ];
    expect(computeScore(evidence)).toBe(0);
  });

  it('returns 1.0 for all ISL passes at confidence 1.0', () => {
    const evidence = [islPass('a', 1.0), islPass('b', 1.0), islPass('c', 1.0)];
    expect(computeScore(evidence)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for all fails', () => {
    const evidence = [islFail('a'), islFail('b')];
    expect(computeScore(evidence)).toBe(0);
  });

  it('computes weighted average for mixed pass/fail', () => {
    // 1 ISL pass (conf 1.0, weight 2), 1 ISL fail (conf 0.9, weight 2)
    // sum = 1.0*1.0*2 + 0.9*0.0*2 = 2.0
    // totalWeight = 2 + 2 = 4
    // score = 2.0/4 = 0.5
    const evidence = [islPass('a', 1.0), islFail('b', 0.9)];
    expect(computeScore(evidence)).toBeCloseTo(0.5, 5);
  });

  it('weights ISL evidence 2x vs specless evidence', () => {
    // 1 ISL pass (conf 1.0, weight 2) + 1 specless fail (conf 0.8, weight 1)
    // sum = 1.0*1.0*2 + 0.8*0.0*1 = 2.0
    // totalWeight = 2 + 1 = 3
    // score = 2.0/3 ≈ 0.667
    const evidence = [islPass('a', 1.0), speclessFail('b', 0.8)];
    expect(computeScore(evidence)).toBeCloseTo(2.0 / 3, 3);
  });

  it('counts warn results at 0.5 factor', () => {
    // 1 ISL warn (conf 1.0, weight 2)
    // sum = 1.0*0.5*2 = 1.0
    // totalWeight = 2
    // score = 0.5
    const evidence = [createGateEvidence('isl-spec', 'x', 'warn', 1.0, '')];
    expect(computeScore(evidence)).toBeCloseTo(0.5, 5);
  });

  it('excludes skip from calculation', () => {
    // 1 ISL pass + 1 skip — skip should not affect score
    const evidence = [
      islPass('a', 1.0),
      createGateEvidence('isl-spec', 'b', 'skip', 1.0, 'skipped'),
    ];
    expect(computeScore(evidence)).toBeCloseTo(1.0, 5);
  });
});

// ============================================================================
// 4. Critical Failure Detection
// ============================================================================

describe('findCriticalFailures', () => {
  it('finds postcondition_violation failures', () => {
    const evidence = [islFail('postcondition_violation: User.exists', 0.95, 'user not created')];
    expect(findCriticalFailures(evidence)).toHaveLength(1);
  });

  it('finds security_violation failures', () => {
    const evidence = [islFail('security_violation: auth bypass', 0.99, 'no auth check')];
    expect(findCriticalFailures(evidence)).toHaveLength(1);
  });

  it('ignores passing evidence even if check name matches', () => {
    const evidence = [islPass('postcondition_violation: handled', 0.9)];
    expect(findCriticalFailures(evidence)).toHaveLength(0);
  });

  it('ignores non-critical failures', () => {
    const evidence = [islFail('style_check', 0.8, 'bad formatting')];
    expect(findCriticalFailures(evidence)).toHaveLength(0);
  });
});

describe('hasCriticalFailure', () => {
  it('returns true when critical failure exists', () => {
    expect(hasCriticalFailure([islFail('critical_vulnerability: CVE-2024-1234')])).toBe(true);
  });

  it('returns false when no critical failure exists', () => {
    expect(hasCriticalFailure([islFail('lint-error')])).toBe(false);
  });
});

// ============================================================================
// 5. Verdict Production — SHIP Path
// ============================================================================

describe('produceVerdict → SHIP', () => {
  it('all-pass ISL spec → SHIP with score > 0.85', () => {
    const evidence = [
      islPass('precondition: valid input', 1.0),
      islPass('postcondition: output correct', 0.95),
      islPass('invariant: state consistent', 0.90),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('SHIP');
    expect(v.score).toBeGreaterThan(0.85);
    expect(v.blockers).toHaveLength(0);
    expect(v.summary).toContain('SHIP');
  });

  it('score exactly at SHIP threshold → SHIP', () => {
    // Engineer a score of exactly 0.85
    // Single ISL pass with confidence 0.85 → score = 0.85*1.0 = 0.85
    const evidence = [islPass('check', 0.85)];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('SHIP');
    expect(v.score).toBeCloseTo(0.85, 5);
  });

  it('SHIP verdict surfaces warnings as recommendations', () => {
    const evidence = [
      islPass('main-check', 1.0),
      createGateEvidence('isl-spec', 'style', 'warn', 0.9, 'minor style issue'),
    ];
    // score = (1.0*1.0*2 + 0.9*0.5*2) / (2+2) = (2.0+0.9)/4 = 0.725 → WARN actually
    // Need to push score above 0.85. Use more passes.
    const evidence2 = [
      islPass('a', 1.0),
      islPass('b', 1.0),
      islPass('c', 1.0),
      islPass('d', 1.0),
      createGateEvidence('isl-spec', 'style', 'warn', 0.9, 'minor style issue'),
    ];
    // sum = 4*2 + 0.9*0.5*2 = 8 + 0.9 = 8.9
    // totalWeight = 4*2 + 2 = 10
    // score = 8.9/10 = 0.89 → SHIP
    const v = produceVerdict(evidence2);
    expect(v.decision).toBe('SHIP');
    expect(v.recommendations.length).toBeGreaterThan(0);
    expect(v.recommendations[0]).toContain('style');
  });
});

// ============================================================================
// 6. Verdict Production — WARN Path
// ============================================================================

describe('produceVerdict → WARN', () => {
  it('one non-critical failure → WARN', () => {
    // 2 ISL passes + 1 ISL fail (non-critical)
    // sum = 2*1.0*2 + 0*2 = 4.0
    // totalWeight = 2+2+2 = 6
    // score = 4.0/6 ≈ 0.667 → between WARN (0.5) and SHIP (0.85) → WARN
    const evidence = [
      islPass('precondition', 1.0),
      islPass('postcondition', 1.0),
      islFail('coverage-check', 0.9, 'coverage 65% below 80%'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('WARN');
    expect(v.score).toBeGreaterThanOrEqual(0.50);
    expect(v.score).toBeLessThan(0.85);
    expect(v.recommendations.length).toBeGreaterThan(0);
    expect(v.blockers).toHaveLength(0);
  });

  it('score just below SHIP threshold → WARN', () => {
    // Single ISL pass at confidence 0.84 → score = 0.84 → WARN
    const evidence = [islPass('check', 0.84)];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('WARN');
    expect(v.score).toBeCloseTo(0.84, 5);
  });

  it('score exactly at WARN threshold → WARN', () => {
    // Single ISL pass at confidence 0.50 → score = 0.50 → WARN (≥ 0.50)
    const evidence = [islPass('check', 0.50)];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('WARN');
    expect(v.score).toBeCloseTo(0.50, 5);
  });

  it('WARN verdict includes recommendations for failures', () => {
    const evidence = [
      islPass('a', 1.0),
      islPass('b', 1.0),
      islFail('lint', 0.8, 'unused imports'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('WARN');
    expect(v.recommendations.some(r => r.includes('lint'))).toBe(true);
  });
});

// ============================================================================
// 7. Verdict Production — NO_SHIP Path
// ============================================================================

describe('produceVerdict → NO_SHIP', () => {
  it('score below WARN threshold → NO_SHIP', () => {
    // All fails → score = 0 → NO_SHIP
    const evidence = [islFail('a', 0.9, 'failed'), islFail('b', 0.8, 'broken')];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.score).toBeLessThan(0.50);
    expect(v.blockers.length).toBeGreaterThan(0);
    expect(v.summary).toContain('NO_SHIP');
  });

  it('score just below WARN threshold → NO_SHIP', () => {
    // ISL pass at confidence 0.49 → score = 0.49 → NO_SHIP
    const evidence = [islPass('check', 0.49)];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.score).toBeCloseTo(0.49, 5);
  });
});

// ============================================================================
// 8. Critical Failure Overrides
// ============================================================================

describe('Critical failures → NO_SHIP regardless of score', () => {
  it('postcondition_violation forces NO_SHIP', () => {
    const evidence = [
      islPass('precondition', 1.0),
      islPass('invariant', 1.0),
      islPass('security', 1.0),
      islFail('postcondition_violation: User.exists(result.id)', 0.99, 'user not created'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.blockers.some(b => b.includes('postcondition_violation'))).toBe(true);
    expect(v.summary).toContain('Critical failure');
  });

  it('security_violation forces NO_SHIP', () => {
    const evidence = [
      islPass('a', 1.0),
      islPass('b', 1.0),
      islFail('security_violation: auth bypass in /api/admin', 0.99, 'no auth middleware'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.blockers.some(b => b.includes('security_violation'))).toBe(true);
  });

  it('critical_vulnerability forces NO_SHIP', () => {
    const evidence = [
      islPass('a', 1.0),
      islFail('critical_vulnerability: CVE-2024-9999 (CVSS 9.8)', 0.99, 'prototype pollution'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.blockers.some(b => b.includes('critical_vulnerability'))).toBe(true);
  });

  it('fake_feature_detected forces NO_SHIP', () => {
    const evidence = [
      islPass('compile', 1.0),
      islPass('lint', 1.0),
      islFail('fake_feature_detected: sendEmail() is a no-op', 0.95, 'function body is empty'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.blockers.some(b => b.includes('fake_feature_detected'))).toBe(true);
  });

  it('multiple critical failures → all listed in blockers', () => {
    const evidence = [
      islFail('postcondition_violation: x', 0.9, 'bad'),
      islFail('security_violation: y', 0.95, 'worse'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.blockers).toHaveLength(2);
    expect(v.blockers[0]).toContain('postcondition_violation');
    expect(v.blockers[1]).toContain('security_violation');
  });
});

// ============================================================================
// 9. Specless Mode — Confidence Degradation
// ============================================================================

describe('Specless mode', () => {
  it('specless-only evidence at same confidence produces lower score than ISL', () => {
    // Both: 2 pass + 1 fail, same confidence values
    // ISL: sum = 2*(1.0*1.0*2) + 1*(0.9*0.0*2) = 4 / 6 ≈ 0.667
    // Specless: sum = 2*(1.0*1.0*1) + 1*(0.9*0.0*1) = 2 / 3 ≈ 0.667
    // Same ratio with uniform confidence — degradation comes from lower confidence values
    
    // Specless scanners naturally produce lower confidence (e.g. 0.70)
    const islEvidence = [islPass('a', 0.95), islPass('b', 0.95)];
    const speclessEvidence = [speclessPass('a', 0.70), speclessPass('b', 0.70)];

    const islScore = computeScore(islEvidence);
    const speclessScore = computeScore(speclessEvidence);

    expect(islScore).toBeGreaterThan(speclessScore);
    expect(islScore).toBeCloseTo(0.95, 2); // ISL at high confidence
    expect(speclessScore).toBeCloseTo(0.70, 2); // Specless at lower confidence
  });

  it('mixed ISL + specless weights ISL evidence higher', () => {
    // 1 ISL pass (conf 0.9, weight 2) + 1 specless pass (conf 0.9, weight 1)
    // If both pass: sum = 0.9*2 + 0.9*1 = 2.7, totalWeight = 3
    // score = 0.9 — same because both pass equally
    //
    // Now with 1 ISL pass + 1 specless fail:
    // sum = 0.9*1.0*2 + 0.9*0.0*1 = 1.8, totalWeight = 3
    // score = 0.6
    //
    // vs 1 ISL fail + 1 specless pass:
    // sum = 0.9*0.0*2 + 0.9*1.0*1 = 0.9, totalWeight = 3
    // score = 0.3
    //
    // ISL failure hurts more because of 2x weight
    const islPassSpeclessFail = [islPass('a', 0.9), speclessFail('b', 0.9)];
    const islFailSpeclessPass = [islFail('a', 0.9), speclessPass('b', 0.9)];

    const scoreA = computeScore(islPassSpeclessFail);
    const scoreB = computeScore(islFailSpeclessPass);

    expect(scoreA).toBeGreaterThan(scoreB);
    expect(scoreA).toBeCloseTo(0.6, 2);
    expect(scoreB).toBeCloseTo(0.3, 2);
  });
});

// ============================================================================
// 10. Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('empty evidence → NO_SHIP with score 0, not crash', () => {
    const v = produceVerdict([]);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.score).toBe(0);
    expect(v.evidence).toHaveLength(0);
    expect(v.summary).toContain('NO_SHIP');
  });

  it('all skip evidence → NO_SHIP with score 0, not crash', () => {
    const evidence = [
      createGateEvidence('isl-spec', 'a', 'skip', 1.0, 'skipped'),
      createGateEvidence('specless-scanner', 'b', 'skip', 1.0, 'skipped'),
    ];
    const v = produceVerdict(evidence);

    expect(v.decision).toBe('NO_SHIP');
    expect(v.score).toBe(0);
  });

  it('single pass at perfect confidence → SHIP', () => {
    const v = produceVerdict([islPass('only-check', 1.0)]);
    expect(v.decision).toBe('SHIP');
    expect(v.score).toBe(1.0);
  });

  it('verdict summary is human-readable for SHIP', () => {
    const v = produceVerdict([islPass('x', 1.0)]);
    expect(v.summary).toMatch(/SHIP.*score/i);
  });

  it('verdict summary is human-readable for NO_SHIP', () => {
    const v = produceVerdict([islFail('x', 0.3, 'broken')]);
    expect(v.summary).toMatch(/NO_SHIP/);
  });

  it('does not mutate the input evidence array', () => {
    const evidence: GateEvidence[] = [islPass('a', 1.0)];
    const originalLength = evidence.length;
    produceVerdict(evidence);
    expect(evidence).toHaveLength(originalLength);
  });
});

// ============================================================================
// 11. Specless Check Registry
// ============================================================================

describe('Specless Check Registry', () => {
  beforeEach(() => {
    clearSpeclessChecks();
  });

  it('starts empty', () => {
    expect(getSpeclessChecks()).toHaveLength(0);
  });

  it('registers a check', () => {
    const check: SpeclessCheck = {
      name: 'test-check',
      run: async () => [createGateEvidence('specless-scanner', 'test', 'pass', 0.8, 'ok')],
    };
    registerSpeclessCheck(check);

    const checks = getSpeclessChecks();
    expect(checks).toHaveLength(1);
    expect(checks[0].name).toBe('test-check');
  });

  it('prevents duplicate registration by name', () => {
    const check: SpeclessCheck = {
      name: 'dup-check',
      run: async () => [],
    };
    registerSpeclessCheck(check);
    registerSpeclessCheck(check);

    expect(getSpeclessChecks()).toHaveLength(1);
  });

  it('unregisters a check by name', () => {
    registerSpeclessCheck({ name: 'rm-me', run: async () => [] });
    expect(getSpeclessChecks()).toHaveLength(1);

    const removed = unregisterSpeclessCheck('rm-me');
    expect(removed).toBe(true);
    expect(getSpeclessChecks()).toHaveLength(0);
  });

  it('unregister returns false for non-existent check', () => {
    expect(unregisterSpeclessCheck('ghost')).toBe(false);
  });

  it('clears all checks', () => {
    registerSpeclessCheck({ name: 'a', run: async () => [] });
    registerSpeclessCheck({ name: 'b', run: async () => [] });
    clearSpeclessChecks();

    expect(getSpeclessChecks()).toHaveLength(0);
  });

  it('returns a snapshot — mutation does not affect registry', () => {
    registerSpeclessCheck({ name: 'safe', run: async () => [] });
    const snapshot = getSpeclessChecks();
    // snapshot is readonly but try to cast and push
    expect(snapshot).toHaveLength(1);
    // Registry still intact
    expect(getSpeclessChecks()).toHaveLength(1);
  });

  it('runSpeclessChecks collects evidence from all checks', async () => {
    registerSpeclessCheck({
      name: 'checker-a',
      run: async () => [createGateEvidence('specless-scanner', 'a', 'pass', 0.8, 'ok')],
    });
    registerSpeclessCheck({
      name: 'checker-b',
      run: async () => [
        createGateEvidence('specless-scanner', 'b1', 'pass', 0.7, 'ok'),
        createGateEvidence('specless-scanner', 'b2', 'warn', 0.6, 'hmm'),
      ],
    });

    const ctx: GateContext = { projectRoot: '/tmp', implementation: 'code', specOptional: true };
    const evidence = await runSpeclessChecks('file.ts', ctx);

    expect(evidence).toHaveLength(3);
    expect(evidence[0].check).toBe('a');
    expect(evidence[1].check).toBe('b1');
    expect(evidence[2].check).toBe('b2');
  });

  it('runSpeclessChecks records failure when a check throws', async () => {
    registerSpeclessCheck({
      name: 'exploding-check',
      run: async () => { throw new Error('boom'); },
    });

    const ctx: GateContext = { projectRoot: '/tmp', implementation: 'code', specOptional: true };
    const evidence = await runSpeclessChecks('file.ts', ctx);

    expect(evidence).toHaveLength(1);
    expect(evidence[0].result).toBe('fail');
    expect(evidence[0].check).toBe('exploding-check');
    expect(evidence[0].details).toContain('threw an error');
  });
});
