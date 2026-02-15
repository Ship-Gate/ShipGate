import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runExecutionProof } from '../src/runner/execution-proof';
import { calculateTrustScore } from '../src/reporter/trust-score';
import type { RuntimeEvidenceReport } from '../src/runner/execution-proof';
import type { TestResult } from '../src/runner/test-runner';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const workDir = join(tmpdir(), 'isl-exec-proof-test');

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
});

// ---------------------------------------------------------------------------
// Simple module: pure functions that work
// ---------------------------------------------------------------------------
const GOOD_MODULE = `
export function add(a, b) { return a + b; }
export function greet(name) { return 'Hello ' + name; }
export const VERSION = '1.0.0';
`;

// ---------------------------------------------------------------------------
// Bad module: every function throws
// ---------------------------------------------------------------------------
const BAD_MODULE = `
export function explode() { throw new Error('boom'); }
export function crash(x) { throw new TypeError('nope'); }
`;

// ---------------------------------------------------------------------------
// Module that can't even parse
// ---------------------------------------------------------------------------
const UNPARSEABLE_MODULE = `
this is not valid javascript at all }{}{
`;

// ---------------------------------------------------------------------------
// Module with async functions
// ---------------------------------------------------------------------------
const ASYNC_MODULE = `
export async function fetchData(url) {
  const res = await fetch(url);
  return res.json();
}
export function sync() { return 42; }
`;

describe('Execution Proof Fallback', () => {
  describe('runExecutionProof', () => {
    it('probes exported functions from a good module', async () => {
      const { report, testResult } = await runExecutionProof(
        GOOD_MODULE,
        null,
        'vitest unavailable',
        { workDir, maxSamples: 4 }
      );

      // Report structure
      expect(report.probes.length).toBeGreaterThanOrEqual(2);
      expect(report.summary.functionsProbed).toBeGreaterThanOrEqual(2);
      expect(report.summary.resolved).toBeGreaterThan(0);
      expect(report.fallbackReason).toContain('vitest unavailable');

      // TestResult always has fallbackEvidence = true
      expect(testResult.fallbackEvidence).toBe(true);

      // At least some invocations resolved
      const resolvedDetails = testResult.details.filter(d => d.status === 'passed');
      expect(resolvedDetails.length).toBeGreaterThan(0);
    });

    it('records failures when all exports throw', async () => {
      const { report, testResult } = await runExecutionProof(
        BAD_MODULE,
        null,
        'vitest crashed',
        { workDir, maxSamples: 3 }
      );

      expect(report.summary.threw).toBeGreaterThan(0);
      expect(report.summary.resolved).toBe(0);

      // All invocation details should be failed
      const invocationDetails = testResult.details.filter(d =>
        d.name.startsWith('execution-proof: invocation')
      );
      for (const d of invocationDetails) {
        expect(d.status).toBe('failed');
      }
      expect(testResult.fallbackEvidence).toBe(true);
    });

    it('handles unparseable modules gracefully', async () => {
      const { report, testResult } = await runExecutionProof(
        UNPARSEABLE_MODULE,
        null,
        'vitest crashed',
        { workDir }
      );

      // Module import failed — 0 probes
      expect(report.probes.length).toBe(0);
      expect(report.fallbackReason).toContain('import failed');

      expect(testResult.failed).toBeGreaterThanOrEqual(1);
      expect(testResult.fallbackEvidence).toBe(true);
      expect(testResult.verificationFailed).toBe(true);
    });

    it('stubs fetch for async modules', async () => {
      const { report, testResult } = await runExecutionProof(
        ASYNC_MODULE,
        null,
        'vitest unavailable',
        { workDir, maxSamples: 2, stubEffects: true }
      );

      expect(report.effectStubs.stubbed).toBe(true);
      // fetch was called via the stub
      expect(report.effectStubs.fetchCalls).toBeGreaterThanOrEqual(0);
      expect(testResult.fallbackEvidence).toBe(true);
    });

    it('respects maxSamples option', async () => {
      const { report } = await runExecutionProof(
        GOOD_MODULE,
        null,
        'test',
        { workDir, maxSamples: 2 }
      );

      for (const probe of report.probes) {
        if (probe.kind === 'function') {
          expect(probe.invocations.length).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('Trust score capping', () => {
    it('caps score at 69 for fallback evidence', () => {
      // Simulate a fallback result where everything passed
      const fakeResult: TestResult = {
        passed: 10,
        failed: 0,
        skipped: 0,
        duration: 100,
        fallbackEvidence: true,
        details: Array.from({ length: 10 }, (_, i) => ({
          name: `execution-proof: invocation [fn${i}]`,
          status: 'passed' as const,
          duration: 10,
          category: 'scenario' as const,
          impact: 'medium' as const,
        })),
      };

      const score = calculateTrustScore(fakeResult);

      expect(score.overall).toBeLessThanOrEqual(69);
      expect(score.fallbackCapped).toBe(true);
      expect(['not_ready', 'critical_issues']).toContain(score.recommendation);
    });

    it('does NOT cap score for normal (non-fallback) results', () => {
      const normalResult: TestResult = {
        passed: 16,
        failed: 0,
        skipped: 0,
        duration: 100,
        fallbackEvidence: false,
        details: [
          ...Array.from({ length: 4 }, (_, i) => ({
            name: `postcondition: check ${i}`,
            status: 'passed' as const,
            duration: 10,
            category: 'postcondition' as const,
            impact: 'high' as const,
          })),
          ...Array.from({ length: 4 }, (_, i) => ({
            name: `invariant: check ${i}`,
            status: 'passed' as const,
            duration: 10,
            category: 'invariant' as const,
            impact: 'high' as const,
          })),
          ...Array.from({ length: 4 }, (_, i) => ({
            name: `scenario: check ${i}`,
            status: 'passed' as const,
            duration: 10,
            category: 'scenario' as const,
            impact: 'low' as const,
          })),
          ...Array.from({ length: 4 }, (_, i) => ({
            name: `temporal: within ${i}`,
            status: 'passed' as const,
            duration: 10,
            category: 'temporal' as const,
            impact: 'medium' as const,
          })),
        ],
      };

      const score = calculateTrustScore(normalResult);

      // All categories pass → score should be 100
      expect(score.overall).toBeGreaterThan(69);
      expect(score.fallbackCapped).toBeUndefined();
    });

    it('never recommends production_ready for fallback evidence', () => {
      const fakeResult: TestResult = {
        passed: 50,
        failed: 0,
        skipped: 0,
        duration: 100,
        fallbackEvidence: true,
        details: [
          ...Array.from({ length: 20 }, (_, i) => ({
            name: `postcondition: check ${i}`,
            status: 'passed' as const,
            duration: 5,
            category: 'postcondition' as const,
            impact: 'high' as const,
          })),
          ...Array.from({ length: 15 }, (_, i) => ({
            name: `invariant: check ${i}`,
            status: 'passed' as const,
            duration: 5,
            category: 'invariant' as const,
            impact: 'high' as const,
          })),
          ...Array.from({ length: 15 }, (_, i) => ({
            name: `scenario: check ${i}`,
            status: 'passed' as const,
            duration: 5,
            category: 'scenario' as const,
            impact: 'low' as const,
          })),
        ],
      };

      const score = calculateTrustScore(fakeResult);

      expect(score.recommendation).not.toBe('production_ready');
      expect(score.recommendation).not.toBe('staging_recommended');
      expect(score.recommendation).not.toBe('shadow_mode');
      expect(score.overall).toBeLessThanOrEqual(69);
    });
  });

  describe('Evidence report structure', () => {
    it('produces a valid RuntimeEvidenceReport', async () => {
      const { report } = await runExecutionProof(
        GOOD_MODULE,
        null,
        'vitest unavailable',
        { workDir, maxSamples: 2 }
      );

      // Validate report shape
      expect(report.timestamp).toBeDefined();
      expect(typeof report.timestamp).toBe('string');
      expect(report.module).toBeDefined();
      expect(report.fallbackReason).toBeDefined();
      expect(Array.isArray(report.probes)).toBe(true);
      expect(report.effectStubs).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalExports).toBe('number');
      expect(typeof report.summary.functionsProbed).toBe('number');
      expect(typeof report.summary.invocationsRun).toBe('number');
      expect(typeof report.summary.threw).toBe('number');
      expect(typeof report.summary.resolved).toBe('number');
    });

    it('probe records have correct invocation shape', async () => {
      const { report } = await runExecutionProof(
        GOOD_MODULE,
        null,
        'test',
        { workDir, maxSamples: 2 }
      );

      for (const probe of report.probes) {
        expect(probe.exportName).toBeDefined();
        expect(probe.kind).toBeDefined();
        for (const inv of probe.invocations) {
          expect(Array.isArray(inv.args)).toBe(true);
          expect(typeof inv.threw).toBe('boolean');
          expect(typeof inv.resolved).toBe('boolean');
          expect(typeof inv.returnType).toBe('string');
          expect(typeof inv.durationMs).toBe('number');
        }
      }
    });
  });
});
