import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock the gate before importing verifySpec
// ============================================================================

vi.mock('@isl-lang/gate', () => ({
  runAuthoritativeGate: vi.fn(),
}));

// Must import AFTER vi.mock due to ESM hoisting
import { verifySpec } from '../src/verify.js';
import { runAuthoritativeGate } from '@isl-lang/gate';

// Cast to access mock methods
const mockRunGate = vi.mocked(runAuthoritativeGate);

// ============================================================================
// Fixtures
// ============================================================================

function makeGateResult(overrides: Record<string, unknown> = {}) {
  return {
    verdict: 'SHIP' as const,
    exitCode: 0 as const,
    score: 95,
    confidence: 90,
    summary: 'All checks passed',
    aggregation: {
      signals: [],
      overallScore: 95,
      tests: { total: 10, passed: 10, failed: 0, skipped: 0, passRate: 100 },
      findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
      blockingIssues: [],
    },
    thresholds: {
      minScore: 80,
      minTestPassRate: 100,
      minCoverage: 70,
      maxCriticalFindings: 0,
      maxHighFindings: 0,
      allowSkipped: false,
    },
    evidence: {
      schemaVersion: '2.0.0' as const,
      fingerprint: 'abc123',
      islVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      inputs: { specHash: 'a', implHash: 'b' },
      artifacts: [],
    },
    reasons: [] as Array<{
      code: string;
      message: string;
      severity: 'critical' | 'high' | 'medium' | 'info';
      source: string;
      blocking: boolean;
    }>,
    suggestions: [] as string[],
    durationMs: 250,
    ...overrides,
  };
}

// ============================================================================
// verifySpec
// ============================================================================

describe('verifySpec', () => {
  beforeEach(() => {
    mockRunGate.mockReset();
  });

  it('returns SHIP verdict when gate says SHIP', async () => {
    mockRunGate.mockResolvedValue(makeGateResult({ verdict: 'SHIP', score: 95 }) as never);

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.verdict).toBe('SHIP');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(95);
  });

  it('returns WARN verdict when gate says NO_SHIP but score >= 50', async () => {
    mockRunGate.mockResolvedValue(
      makeGateResult({ verdict: 'NO_SHIP', exitCode: 1, score: 65 }) as never,
    );

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.verdict).toBe('WARN');
    expect(result.passed).toBe(false);
    expect(result.score).toBe(65);
  });

  it('returns NO_SHIP verdict when gate says NO_SHIP and score < 50', async () => {
    mockRunGate.mockResolvedValue(
      makeGateResult({ verdict: 'NO_SHIP', exitCode: 1, score: 30 }) as never,
    );

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.verdict).toBe('NO_SHIP');
    expect(result.passed).toBe(false);
  });

  it('maps gate reasons to SDK reasons correctly', async () => {
    mockRunGate.mockResolvedValue(
      makeGateResult({
        reasons: [
          {
            code: 'CRITICAL_FINDING',
            message: 'Hardcoded secret',
            severity: 'critical',
            source: 'security_scan',
            blocking: true,
          },
          {
            code: 'MEDIUM_FINDING',
            message: 'Missing test coverage',
            severity: 'medium',
            source: 'coverage',
            blocking: false,
          },
        ],
      }) as never,
    );

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0].label).toBe('Hardcoded secret');
    expect(result.reasons[0].impact).toBe('critical');
    expect(result.reasons[1].label).toBe('Missing test coverage');
    expect(result.reasons[1].impact).toBe('medium');
  });

  it('maps gate suggestions to string array', async () => {
    mockRunGate.mockResolvedValue(
      makeGateResult({
        suggestions: ['Add more test coverage', 'Review security config'],
      }) as never,
    );

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.suggestions).toEqual([
      'Add more test coverage',
      'Review security config',
    ]);
  });

  it('includes duration from the gate result', async () => {
    mockRunGate.mockResolvedValue(makeGateResult({ durationMs: 1234 }) as never);

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(result.durationMs).toBe(1234);
  });

  it('passes custom thresholds to the gate', async () => {
    mockRunGate.mockResolvedValue(makeGateResult() as never);

    await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
      thresholds: { ship: 90, warn: 60 },
    });

    const callArgs = mockRunGate.mock.calls[0][0] as Record<string, unknown>;
    expect((callArgs.thresholds as Record<string, number>).minScore).toBe(90);
  });

  it('returns frozen (read-only) results', async () => {
    mockRunGate.mockResolvedValue(makeGateResult() as never);

    const result = await verifySpec({
      specPath: 'spec.isl',
      implPath: 'src/',
      projectRoot: '/tmp/project',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
    expect(Object.isFrozen(result.suggestions)).toBe(true);
  });
});
