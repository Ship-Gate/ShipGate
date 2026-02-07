/**
 * Trust Score Engine - Tests
 *
 * Tests for the 0-100 trust score calculator, history tracking,
 * delta detection, and report generation.
 */

import { describe, it, expect } from 'vitest';

import {
  calculateTrustScore,
  resolveConfig,
  generateReport,
  computeDeltaBetween,
  createEmptyHistory,
  recordEntry,
  computeDelta,
  computeTrend,
} from '../src/trust-score/index.js';

import type {
  TrustClauseResult,
  TrustScoreInput,
  TrustCategory,
  TrustHistoryEntry,
} from '../src/trust-score/types.js';

// ============================================================================
// Helpers
// ============================================================================

function clause(
  category: TrustCategory,
  status: 'pass' | 'fail' | 'partial' | 'unknown',
  id?: string,
): TrustClauseResult {
  return {
    id: id ?? `${category}-${status}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    description: `${category} ${status} clause`,
    status,
  };
}

function input(clauses: TrustClauseResult[]): TrustScoreInput {
  return { clauses };
}

// ============================================================================
// Config Resolution
// ============================================================================

describe('resolveConfig', () => {
  it('returns defaults when no config provided', () => {
    const config = resolveConfig();
    expect(config.unknownPenalty).toBe(0.5);
    expect(config.shipThreshold).toBe(80);
    expect(config.warnThreshold).toBe(60);
    expect(config.criticalFailsBlock).toBe(true);
    expect(config.maxHistoryEntries).toBe(50);
  });

  it('normalizes weights to sum to 1.0', () => {
    const config = resolveConfig({ weights: { preconditions: 50, postconditions: 50 } });
    const sum = Object.values(config.normalizedWeights).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('overrides specific weights while keeping defaults for others', () => {
    const config = resolveConfig({ weights: { preconditions: 40 } });
    expect(config.weights.preconditions).toBe(40);
    expect(config.weights.postconditions).toBe(20); // default
  });

  it('clamps unknownPenalty to 0-1', () => {
    expect(resolveConfig({ unknownPenalty: -0.5 }).unknownPenalty).toBe(0);
    expect(resolveConfig({ unknownPenalty: 1.5 }).unknownPenalty).toBe(1);
  });

  it('throws for zero-sum weights', () => {
    expect(() =>
      resolveConfig({
        weights: {
          preconditions: 0,
          postconditions: 0,
          invariants: 0,
          temporal: 0,
          chaos: 0,
          coverage: 0,
        },
      }),
    ).toThrow();
  });
});

// ============================================================================
// Score Calculation
// ============================================================================

describe('calculateTrustScore', () => {
  it('returns 100 when all clauses pass', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'pass'),
        clause('temporal', 'pass'),
        clause('chaos', 'pass'),
        clause('coverage', 'pass'),
      ]),
    );

    expect(result.score).toBe(100);
    expect(result.verdict).toBe('SHIP');
    expect(result.counts.pass).toBe(6);
    expect(result.counts.fail).toBe(0);
  });

  it('returns 0 when all clauses fail', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'fail'),
        clause('postconditions', 'fail'),
        clause('invariants', 'fail'),
        clause('temporal', 'fail'),
        clause('chaos', 'fail'),
        clause('coverage', 'fail'),
      ]),
    );

    expect(result.score).toBe(0);
    expect(result.verdict).toBe('BLOCK');
    expect(result.counts.fail).toBe(6);
  });

  it('scores partial clauses at 50', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'partial'),
        clause('postconditions', 'partial'),
        clause('invariants', 'partial'),
        clause('temporal', 'partial'),
        clause('chaos', 'partial'),
        clause('coverage', 'partial'),
      ]),
    );

    expect(result.score).toBe(50);
    expect(result.verdict).toBe('BLOCK');
  });

  it('applies unknown penalty at 50% by default', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'unknown'),
        clause('postconditions', 'unknown'),
        clause('invariants', 'unknown'),
        clause('temporal', 'unknown'),
        clause('chaos', 'unknown'),
        clause('coverage', 'unknown'),
      ]),
    );

    // Default unknownPenalty = 0.5, so unknown clauses score (1-0.5)*100 = 50
    expect(result.score).toBe(50);
  });

  it('applies no penalty when unknownPenalty is 0', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'unknown'),
        clause('postconditions', 'unknown'),
      ]),
      { unknownPenalty: 0 },
    );

    expect(result.score).toBe(100);
  });

  it('applies full penalty when unknownPenalty is 1', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'unknown'),
        clause('postconditions', 'unknown'),
      ]),
      { unknownPenalty: 1 },
    );

    expect(result.score).toBe(0);
  });

  it('handles mixed statuses with correct weighting', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),    // 100
        clause('preconditions', 'pass'),    // 100 -> category avg 100
        clause('postconditions', 'fail'),   // 0   -> category avg 0
        clause('invariants', 'pass'),       // 100 -> category avg 100
        clause('temporal', 'partial'),      // 50  -> category avg 50
        clause('chaos', 'pass'),            // 100 -> category avg 100
        clause('coverage', 'unknown'),      // 50  -> category avg 50
      ]),
    );

    // Weighted: pre=100*0.2 + post=0*0.2 + inv=100*0.2 + temp=50*0.15 + chaos=100*0.1 + cov=50*0.15
    // = 20 + 0 + 20 + 7.5 + 10 + 7.5 = 65
    expect(result.score).toBe(65);
    expect(result.verdict).toBe('WARN');
  });

  it('forces score to 0 on critical failure (invariant fail)', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'fail'),    // Critical!
        clause('temporal', 'pass'),
        clause('chaos', 'pass'),
        clause('coverage', 'pass'),
      ]),
      { criticalFailsBlock: true },
    );

    expect(result.score).toBe(0);
    expect(result.verdict).toBe('BLOCK');
    expect(result.criticalBlock).toBe(true);
  });

  it('does not force block when criticalFailsBlock is disabled', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'fail'),
        clause('temporal', 'pass'),
        clause('chaos', 'pass'),
        clause('coverage', 'pass'),
      ]),
      { criticalFailsBlock: false },
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.criticalBlock).toBe(false);
  });

  it('handles empty input with unknown penalty on all categories', () => {
    const result = calculateTrustScore(input([]));

    // All categories are empty, treated as unknown with default 0.5 penalty
    expect(result.score).toBe(50);
    expect(result.totalClauses).toBe(0);
  });

  it('uses custom weights', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'fail'),
      ]),
      {
        weights: {
          preconditions: 90,
          postconditions: 10,
          invariants: 0,
          temporal: 0,
          chaos: 0,
          coverage: 0,
        },
        criticalFailsBlock: false,
      },
    );

    // pre=100*(90/100) + post=0*(10/100) + empty categories with unknownPenalty
    // But 0-weight categories have 0 impact
    expect(result.score).toBe(90);
  });

  it('returns correct verdict for threshold boundaries', () => {
    const allPass = input([
      clause('preconditions', 'pass'),
      clause('postconditions', 'pass'),
      clause('invariants', 'pass'),
      clause('temporal', 'pass'),
      clause('chaos', 'pass'),
      clause('coverage', 'pass'),
    ]);

    const ship = calculateTrustScore(allPass, { shipThreshold: 100 });
    expect(ship.verdict).toBe('SHIP');

    const warn = calculateTrustScore(allPass, { shipThreshold: 101 });
    expect(warn.verdict).toBe('WARN');
  });

  it('always returns integer scores', () => {
    for (let i = 0; i < 20; i++) {
      const statuses: Array<'pass' | 'fail' | 'partial' | 'unknown'> = ['pass', 'fail', 'partial', 'unknown'];
      const clauses: TrustClauseResult[] = [];

      for (const cat of ['preconditions', 'postconditions', 'invariants', 'temporal', 'chaos', 'coverage'] as TrustCategory[]) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        clauses.push(clause(cat, status));
      }

      const result = calculateTrustScore(input(clauses), { criticalFailsBlock: false });
      expect(Number.isInteger(result.score)).toBe(true);
    }
  });

  it('score is always 0-100', () => {
    const result1 = calculateTrustScore(input([clause('preconditions', 'pass')]));
    expect(result1.score).toBeGreaterThanOrEqual(0);
    expect(result1.score).toBeLessThanOrEqual(100);

    const result2 = calculateTrustScore(input([clause('preconditions', 'fail')]));
    expect(result2.score).toBeGreaterThanOrEqual(0);
    expect(result2.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// History & Delta Detection
// ============================================================================

describe('history', () => {
  it('creates empty history', () => {
    const history = createEmptyHistory();
    expect(history.version).toBe(1);
    expect(history.entries).toHaveLength(0);
  });

  it('records entries newest-first', () => {
    const config = resolveConfig();
    let history = createEmptyHistory();

    const result1 = calculateTrustScore(input([clause('preconditions', 'pass')]));
    history = recordEntry(history, result1, config);

    const result2 = calculateTrustScore(input([clause('preconditions', 'fail')]));
    history = recordEntry(history, result2, config);

    expect(history.entries).toHaveLength(2);
    // Newest first
    expect(history.entries[0].score).toBeLessThan(history.entries[1].score);
  });

  it('trims history beyond maxHistoryEntries', () => {
    const config = resolveConfig({ maxHistoryEntries: 3 });
    let history = createEmptyHistory();

    for (let i = 0; i < 5; i++) {
      const result = calculateTrustScore(input([clause('preconditions', 'pass')]));
      history = recordEntry(history, result, config);
    }

    expect(history.entries).toHaveLength(3);
  });

  it('computes delta from previous entry', () => {
    const config = resolveConfig();
    let history = createEmptyHistory();

    const result1 = calculateTrustScore(input([
      clause('preconditions', 'fail'),
      clause('postconditions', 'pass'),
    ]), { criticalFailsBlock: false });
    history = recordEntry(history, result1, config);

    const result2 = calculateTrustScore(input([
      clause('preconditions', 'pass'),
      clause('postconditions', 'pass'),
    ]));

    const delta = computeDelta(result2, history);
    expect(delta).toBeDefined();
    expect(delta!.scoreDelta).toBeGreaterThan(0);
    expect(delta!.improved.length).toBeGreaterThan(0);
  });

  it('returns undefined delta for empty history', () => {
    const history = createEmptyHistory();
    const result = calculateTrustScore(input([clause('preconditions', 'pass')]));
    const delta = computeDelta(result, history);
    expect(delta).toBeUndefined();
  });
});

describe('computeDeltaBetween', () => {
  it('detects improvement', () => {
    const current = calculateTrustScore(
      input([clause('preconditions', 'pass'), clause('postconditions', 'pass')]),
    );

    const previous: TrustHistoryEntry = {
      score: 50,
      verdict: 'BLOCK',
      categoryScores: {
        preconditions: 50,
        postconditions: 50,
        invariants: 50,
        temporal: 50,
        chaos: 50,
        coverage: 50,
      },
      timestamp: new Date().toISOString(),
      counts: { pass: 3, fail: 3, partial: 0, unknown: 0 },
    };

    const delta = computeDeltaBetween(current, previous);
    expect(delta.scoreDelta).toBeGreaterThan(0);
    expect(delta.verdictChanged).toBe(true);
    expect(delta.previousVerdict).toBe('BLOCK');
  });

  it('detects regression', () => {
    const current = calculateTrustScore(
      input([clause('preconditions', 'fail')]),
      { criticalFailsBlock: false },
    );

    const previous: TrustHistoryEntry = {
      score: 100,
      verdict: 'SHIP',
      categoryScores: {
        preconditions: 100,
        postconditions: 100,
        invariants: 100,
        temporal: 100,
        chaos: 100,
        coverage: 100,
      },
      timestamp: new Date().toISOString(),
      counts: { pass: 6, fail: 0, partial: 0, unknown: 0 },
    };

    const delta = computeDeltaBetween(current, previous);
    expect(delta.scoreDelta).toBeLessThan(0);
    expect(delta.regressed.length).toBeGreaterThan(0);
  });
});

describe('computeTrend', () => {
  it('returns stable for empty history', () => {
    const history = createEmptyHistory();
    expect(computeTrend(history)).toBe('stable');
  });

  it('returns stable for single entry', () => {
    const history: ReturnType<typeof createEmptyHistory> = {
      version: 1,
      entries: [{
        score: 80,
        verdict: 'SHIP',
        categoryScores: { preconditions: 80, postconditions: 80, invariants: 80, temporal: 80, chaos: 80, coverage: 80 },
        timestamp: new Date().toISOString(),
        counts: { pass: 6, fail: 0, partial: 0, unknown: 0 },
      }],
      lastUpdated: new Date().toISOString(),
    };
    expect(computeTrend(history)).toBe('stable');
  });

  it('detects improving trend', () => {
    const entries: TrustHistoryEntry[] = [
      { score: 90, verdict: 'SHIP', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 80, verdict: 'SHIP', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 70, verdict: 'WARN', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 60, verdict: 'WARN', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 50, verdict: 'BLOCK', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
    ];

    const history: ReturnType<typeof createEmptyHistory> = {
      version: 1,
      entries,
      lastUpdated: new Date().toISOString(),
    };

    expect(computeTrend(history)).toBe('improving');
  });

  it('detects declining trend', () => {
    const entries: TrustHistoryEntry[] = [
      { score: 50, verdict: 'BLOCK', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 60, verdict: 'WARN', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 70, verdict: 'WARN', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 80, verdict: 'SHIP', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
      { score: 90, verdict: 'SHIP', categoryScores: {} as any, timestamp: '', counts: { pass: 0, fail: 0, partial: 0, unknown: 0 } },
    ];

    const history: ReturnType<typeof createEmptyHistory> = {
      version: 1,
      entries,
      lastUpdated: new Date().toISOString(),
    };

    expect(computeTrend(history)).toBe('declining');
  });
});

// ============================================================================
// Report Generation
// ============================================================================

describe('generateReport', () => {
  it('generates text report with all sections', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'fail'),
        clause('invariants', 'pass'),
        clause('temporal', 'partial'),
        clause('chaos', 'unknown'),
        clause('coverage', 'pass'),
      ]),
      { criticalFailsBlock: false },
    );

    const report = generateReport(result);

    // Text report should contain key sections
    expect(report.text).toContain('Category Breakdown');
    expect(report.text).toContain('preconditions');
    expect(report.text).toContain('postconditions');
    expect(report.text).toContain('/100');
  });

  it('generates valid JSON report', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
      ]),
    );

    const report = generateReport(result);

    expect(report.json.score).toBe(result.score);
    expect(report.json.verdict).toBe(result.verdict);
    expect(report.json.categories).toHaveLength(6);
    expect(report.json.counts.total).toBe(2);
    expect(report.json.timestamp).toBeTruthy();
  });

  it('includes delta in report when provided', () => {
    const result = calculateTrustScore(
      input([clause('preconditions', 'pass')]),
    );

    const previous: TrustHistoryEntry = {
      score: 50,
      verdict: 'BLOCK',
      categoryScores: {
        preconditions: 50, postconditions: 50, invariants: 50,
        temporal: 50, chaos: 50, coverage: 50,
      },
      timestamp: new Date().toISOString(),
      counts: { pass: 3, fail: 3, partial: 0, unknown: 0 },
    };

    const delta = computeDeltaBetween(result, previous);
    const report = generateReport(result, delta);

    expect(report.text).toContain('Delta from previous run');
    expect(report.json.delta).toBeDefined();
    expect(report.json.delta!.scoreDelta).toBeGreaterThan(0);
  });
});
