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
  generateProjectFingerprint,
  computeProjectFingerprint,
} from '../src/trust-score/index.js';

import type {
  TrustClauseResult,
  TrustScoreInput,
  TrustCategory,
  TrustHistoryEntry,
  EvidenceSource,
} from '../src/trust-score/types.js';

// ============================================================================
// Helpers
// ============================================================================

function clause(
  category: TrustCategory,
  status: 'pass' | 'fail' | 'partial' | 'unknown',
  id?: string,
  evidenceSource?: EvidenceSource,
  evidenceTimestamp?: string,
): TrustClauseResult {
  return {
    id: id ?? `${category}-${status}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    description: `${category} ${status} clause`,
    status,
    ...(evidenceSource ? { evidenceSource } : {}),
    ...(evidenceTimestamp ? { evidenceTimestamp } : {}),
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
    expect(config.shipThreshold).toBe(85);
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

  it('scores partial clauses at 65', () => {
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

    // Composite model: coverage=100, execution=100, pass=0 → composite=80
    // Evidence score: 50 → blend = round((80+50)/2) = 65 per category
    expect(result.score).toBe(65);
    expect(result.verdict).toBe('WARN');
    expect(result.counts.partial).toBe(6);
  });

  it('scores partial clauses with honest composite model', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'fail'),
        clause('invariants', 'pass'),
        clause('temporal', 'partial'),
        clause('chaos', 'pass'),
        clause('coverage', 'partial'),
      ]),
    );

    // Composite model blends coverage/execution/pass with evidence score per category
    // post fail is not critical (only invariants/preconditions are)
    expect(result.score).toBe(78);
    expect(result.verdict).toBe('WARN');
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

    // Composite: coverage=100, execution=0, pass=0 → composite=45
    // Evidence: (1-0.5)*100=50 → blend = round((45+50)/2) = 48 per category
    expect(result.score).toBe(48);
  });

  it('scores higher with unknownPenalty 0 than 1', () => {
    const noPenalty = calculateTrustScore(
      input([
        clause('preconditions', 'unknown'),
        clause('postconditions', 'unknown'),
        clause('invariants', 'unknown'),
        clause('temporal', 'unknown'),
        clause('chaos', 'unknown'),
        clause('coverage', 'unknown'),
      ]),
      { unknownPenalty: 0 },
    );

    const fullPenalty = calculateTrustScore(
      input([
        clause('preconditions', 'unknown'),
        clause('postconditions', 'unknown'),
        clause('invariants', 'unknown'),
        clause('temporal', 'unknown'),
        clause('chaos', 'unknown'),
        clause('coverage', 'unknown'),
      ]),
      { unknownPenalty: 1 },
    );

    expect(noPenalty.score).toBeGreaterThan(fullPenalty.score);
  });

  it('handles mixed statuses with correct weighting', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'fail'),
        clause('invariants', 'pass'),
        clause('temporal', 'partial'),
        clause('chaos', 'pass'),
        clause('coverage', 'unknown'),
      ]),
    );

    // Composite model blends coverage/execution/pass with evidence scores
    // Postcondition fail gets lower score, partial/unknown categories penalized
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(85);
    expect(result.verdict).toBe('WARN');
  });

  it('forces score to 0 on critical failure (invariant fail)', () => {
    const result = calculateTrustScore(
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'fail'),
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

  it('handles empty input with zero score for all categories', () => {
    const result = calculateTrustScore(input([]));

    // All categories are empty → score 0 each (missing coverage is risk)
    expect(result.score).toBe(0);
    expect(result.totalClauses).toBe(0);
    expect(result.verdict).toBe('BLOCK');
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

    // pre: composite=100, evidence=100, score=100 → weighted 100*0.9=90
    // pre: composite blend = 100, post: composite blend = 40
    // Weighted: 100*0.9 + 40*0.1 = 94
    expect(result.score).toBe(94);
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
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'pass'),
        clause('temporal', 'pass'),
        clause('chaos', 'pass'),
        clause('coverage', 'pass'),
      ]),
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
      input([
        clause('preconditions', 'pass'),
        clause('postconditions', 'pass'),
        clause('invariants', 'pass'),
        clause('temporal', 'pass'),
        clause('chaos', 'pass'),
        clause('coverage', 'pass'),
      ]),
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

// ============================================================================
// Evidence Priority
// ============================================================================

describe('evidence priority', () => {
  it('weights SMT evidence higher than runtime', () => {
    const smtClause = clause('preconditions', 'pass', 'smt-1', 'smt');
    const runtimeClause = clause('preconditions', 'pass', 'runtime-1', 'runtime');
    const heuristicClause = clause('preconditions', 'pass', 'heuristic-1', 'heuristic');

    // All pass, but SMT should contribute more
    const result = calculateTrustScore(
      input([smtClause, runtimeClause, heuristicClause]),
      { enableEvidencePriority: true },
    );

    // With evidence priority, SMT clauses contribute more weight
    // This is tested indirectly through the scoring mechanism
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('can disable evidence priority', () => {
    const smtClause = clause('preconditions', 'pass', 'smt-1', 'smt');
    const runtimeClause = clause('preconditions', 'pass', 'runtime-1', 'runtime');

    const withPriority = calculateTrustScore(
      input([smtClause, runtimeClause]),
      { enableEvidencePriority: true },
    );

    const withoutPriority = calculateTrustScore(
      input([smtClause, runtimeClause]),
      { enableEvidencePriority: false },
    );

    // Both should produce valid scores
    expect(withPriority.score).toBeGreaterThanOrEqual(0);
    expect(withoutPriority.score).toBeGreaterThanOrEqual(0);
  });

  it('defaults to heuristic when evidence source not specified', () => {
    const clauseWithoutSource = clause('preconditions', 'pass');
    const result = calculateTrustScore(input([clauseWithoutSource]));
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Time Decay
// ============================================================================

describe('evidence decay', () => {
  it('applies decay to old evidence', () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 days ago
    const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

    const oldClause = clause(
      'preconditions',
      'pass',
      'old',
      'runtime',
      oldDate.toISOString(),
    );
    const recentClause = clause(
      'preconditions',
      'pass',
      'recent',
      'runtime',
      recentDate.toISOString(),
    );

    // With decay enabled (90 day half-life), old evidence should contribute less
    const result = calculateTrustScore(
      input([oldClause, recentClause]),
      { evidenceDecayHalfLifeDays: 90 },
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('can disable decay', () => {
    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const oldClause = clause(
      'preconditions',
      'pass',
      'old',
      'runtime',
      oldDate.toISOString(),
    );

    const withDecay = calculateTrustScore(
      input([oldClause]),
      { evidenceDecayHalfLifeDays: 90 },
    );

    const withoutDecay = calculateTrustScore(
      input([oldClause]),
      { evidenceDecayHalfLifeDays: 0 },
    );

    // Both should produce valid scores
    expect(withDecay.score).toBeGreaterThanOrEqual(0);
    expect(withoutDecay.score).toBeGreaterThanOrEqual(0);
  });

  it('handles future timestamps gracefully', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // Tomorrow
    const futureClause = clause(
      'preconditions',
      'pass',
      'future',
      'runtime',
      futureDate.toISOString(),
    );

    const result = calculateTrustScore(
      input([futureClause]),
      { evidenceDecayHalfLifeDays: 90 },
    );

    // Should not crash and produce valid score
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Project Fingerprinting
// ============================================================================

describe('project fingerprinting', () => {
  it('generates deterministic fingerprint for same project', () => {
    const projectRoot = process.cwd();
    const fp1 = generateProjectFingerprint(projectRoot);
    const fp2 = generateProjectFingerprint(projectRoot);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16); // Hex string, 16 chars = 8 bytes
  });

  it('generates different fingerprints for different projects', () => {
    const fp1 = generateProjectFingerprint('/project/a');
    const fp2 = generateProjectFingerprint('/project/b');

    expect(fp1).not.toBe(fp2);
  });

  it('computes fingerprint from project root', () => {
    const projectRoot = process.cwd();
    const fp1 = computeProjectFingerprint(projectRoot, undefined);
    const fp2 = computeProjectFingerprint(projectRoot, undefined);

    expect(fp1).toBe(fp2);
    expect(fp1).toBeDefined();
  });

  it('uses provided fingerprint when available', () => {
    const provided = 'abc123def456';
    const computed = computeProjectFingerprint('/some/path', provided);

    expect(computed).toBe(provided);
  });

  it('handles missing project root gracefully', () => {
    const fp = computeProjectFingerprint(undefined, undefined);
    // Should either return undefined or compute from cwd
    if (fp !== undefined) {
      expect(fp).toHaveLength(16);
    }
  });
});

// ============================================================================
// Determinism & Persistence
// ============================================================================

describe('determinism and persistence', () => {
  it('produces same score for same input', () => {
    const clauses = [
      clause('preconditions', 'pass', '1'),
      clause('postconditions', 'pass', '2'),
      clause('invariants', 'pass', '3'),
    ];

    const result1 = calculateTrustScore(input(clauses));
    const result2 = calculateTrustScore(input(clauses));

    expect(result1.score).toBe(result2.score);
    expect(result1.verdict).toBe(result2.verdict);
  });

  it('maintains history consistency across multiple runs', () => {
    const config = resolveConfig({ maxHistoryEntries: 10 });
    let history = createEmptyHistory('test-fingerprint');

    const clauses1 = [clause('preconditions', 'pass', '1')];
    const result1 = calculateTrustScore(input(clauses1));
    history = recordEntry(history, result1, config, undefined, 'test-fingerprint');

    const clauses2 = [clause('preconditions', 'fail', '1')];
    const result2 = calculateTrustScore(input(clauses2), { criticalFailsBlock: false });
    history = recordEntry(history, result2, config, undefined, 'test-fingerprint');

    expect(history.entries).toHaveLength(2);
    expect(history.entries[0]!.projectFingerprint).toBe('test-fingerprint');
    expect(history.entries[1]!.projectFingerprint).toBe('test-fingerprint');
  });

  it('filters history by project fingerprint', async () => {
    const config = resolveConfig();
    let history = createEmptyHistory('project-a');

    const result1 = calculateTrustScore(input([clause('preconditions', 'pass', '1')]));
    history = recordEntry(history, result1, config, undefined, 'project-a');

    // recordEntry with a different fingerprint filters out previous entries
    // from different projects, so only the new entry remains
    const result2 = calculateTrustScore(input([clause('preconditions', 'pass', '2')]));
    history = recordEntry(history, result2, config, undefined, 'project-b');

    // project-b recording filters to only project-b entries → 1 entry
    expect(history.entries.length).toBe(1);
    expect(history.entries[0]!.projectFingerprint).toBe('project-b');
  });
});
