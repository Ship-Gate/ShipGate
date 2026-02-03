/**
 * Tests for ISL Proof Bundle Manifest v2
 */

import { describe, it, expect } from 'vitest';
import {
  calculateVerdict,
  calculateBundleId,
  calculateSpecHash,
  signManifest,
  verifyManifestSignature,
  type ProofBundleManifest,
  type ManifestGateResult,
  type BuildResult,
  type TestResult,
} from '../src/manifest.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createGateResult = (overrides: Partial<ManifestGateResult> = {}): ManifestGateResult => ({
  verdict: 'SHIP',
  score: 100,
  fingerprint: 'abc123',
  blockers: 0,
  warnings: 0,
  violations: [],
  policyBundleVersion: '1.0.0',
  rulepackVersions: [{ id: 'auth', version: '1.0.0', rulesCount: 5 }],
  timestamp: '2026-02-02T00:00:00.000Z',
  ...overrides,
});

const createBuildResult = (overrides: Partial<BuildResult> = {}): BuildResult => ({
  tool: 'tsc',
  toolVersion: '5.3.0',
  status: 'pass',
  errorCount: 0,
  warningCount: 0,
  durationMs: 1000,
  timestamp: '2026-02-02T00:00:00.000Z',
  ...overrides,
});

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult => ({
  framework: 'vitest',
  frameworkVersion: '1.2.0',
  status: 'pass',
  totalTests: 10,
  passedTests: 10,
  failedTests: 0,
  skippedTests: 0,
  durationMs: 2000,
  timestamp: '2026-02-02T00:00:00.000Z',
  ...overrides,
});

// ============================================================================
// calculateVerdict Tests
// ============================================================================

describe('calculateVerdict', () => {
  it('returns PROVEN when gate SHIP, build pass, tests pass with count > 0', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'pass' }),
      createTestResult({ status: 'pass', totalTests: 10, passedTests: 10 })
    );

    expect(result.verdict).toBe('PROVEN');
    expect(result.reason).toContain('Gate SHIP');
    expect(result.reason).toContain('10 tests');
  });

  it('returns VIOLATED when gate is NO_SHIP', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'NO_SHIP', score: 50, blockers: 2 }),
      createBuildResult({ status: 'pass' }),
      createTestResult({ status: 'pass' })
    );

    expect(result.verdict).toBe('VIOLATED');
    expect(result.reason).toContain('Gate verdict is NO_SHIP');
    expect(result.reason).toContain('score: 50');
    expect(result.reason).toContain('blockers: 2');
  });

  it('returns VIOLATED when build fails', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'fail', errorCount: 5 }),
      createTestResult({ status: 'pass' })
    );

    expect(result.verdict).toBe('VIOLATED');
    expect(result.reason).toContain('Build failed');
    expect(result.reason).toContain('5 errors');
  });

  it('returns VIOLATED when tests fail', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'pass' }),
      createTestResult({ status: 'fail', totalTests: 10, passedTests: 7, failedTests: 3 })
    );

    expect(result.verdict).toBe('VIOLATED');
    expect(result.reason).toContain('Tests failed');
    expect(result.reason).toContain('3 of 10 tests failed');
  });

  it('returns INCOMPLETE_PROOF when tests == 0', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'pass' }),
      createTestResult({ status: 'no_tests', totalTests: 0, passedTests: 0 })
    );

    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.reason).toContain('testCount = 0');
  });

  it('returns PROVEN when tests == 0 but noTestsRequired is declared', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'pass' }),
      createTestResult({ status: 'no_tests', totalTests: 0 }),
      { noTestsRequired: true, reason: 'utility library' }
    );

    expect(result.verdict).toBe('PROVEN');
    // V2 verdict uses a different message format
    expect(result.reason).toContain('Gate SHIP');
  });

  it('returns PROVEN when build is skipped (no tsconfig)', () => {
    const result = calculateVerdict(
      createGateResult({ verdict: 'SHIP' }),
      createBuildResult({ status: 'skipped' }),
      createTestResult({ status: 'pass', totalTests: 5, passedTests: 5 })
    );

    expect(result.verdict).toBe('PROVEN');
  });
});

// ============================================================================
// calculateBundleId Tests
// ============================================================================

describe('calculateBundleId', () => {
  const createBaseManifest = () => ({
    schemaVersion: '2.0.0' as const,
    generatedAt: '2026-02-02T00:00:00.000Z',
    spec: {
      domain: 'auth',
      version: '1.0.0',
      specHash: 'abc123',
    },
    policyVersion: {
      bundleVersion: '1.0.0',
      islStudioVersion: '0.1.0',
      packs: [],
    },
    gateResult: createGateResult(),
    buildResult: createBuildResult(),
    testResult: createTestResult(),
    iterations: [],
    verdict: 'PROVEN' as const,
    verdictReason: 'All checks passed',
    files: ['manifest.json'],
    project: { root: '/app' },
  });

  it('produces deterministic bundle ID', () => {
    const manifest = createBaseManifest();
    const id1 = calculateBundleId(manifest);
    const id2 = calculateBundleId(manifest);

    expect(id1).toBe(id2);
    expect(id1).toHaveLength(32);
  });

  it('produces different ID when spec changes', () => {
    const manifest1 = createBaseManifest();
    const manifest2 = { ...createBaseManifest(), spec: { ...createBaseManifest().spec, specHash: 'different' } };

    const id1 = calculateBundleId(manifest1);
    const id2 = calculateBundleId(manifest2);

    expect(id1).not.toBe(id2);
  });

  it('produces different ID when verdict changes', () => {
    const manifest1 = createBaseManifest();
    const manifest2 = { ...createBaseManifest(), verdict: 'VIOLATED' as const };

    const id1 = calculateBundleId(manifest1);
    const id2 = calculateBundleId(manifest2);

    expect(id1).not.toBe(id2);
  });
});

// ============================================================================
// calculateSpecHash Tests
// ============================================================================

describe('calculateSpecHash', () => {
  it('produces consistent hash for same content', () => {
    const content = 'domain Auth version "1.0.0"';
    const hash1 = calculateSpecHash(content);
    const hash2 = calculateSpecHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different hash for different content', () => {
    const hash1 = calculateSpecHash('domain Auth');
    const hash2 = calculateSpecHash('domain Payments');

    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Signature Tests
// ============================================================================

describe('signManifest and verifyManifestSignature', () => {
  const createFullManifest = (): ProofBundleManifest => ({
    schemaVersion: '2.0.0',
    bundleId: 'test-bundle-id',
    generatedAt: '2026-02-02T00:00:00.000Z',
    spec: {
      domain: 'auth',
      version: '1.0.0',
      specHash: 'abc123',
    },
    policyVersion: {
      bundleVersion: '1.0.0',
      islStudioVersion: '0.1.0',
      packs: [],
    },
    gateResult: createGateResult(),
    buildResult: createBuildResult(),
    testResult: createTestResult(),
    iterations: [],
    verdict: 'PROVEN',
    verdictReason: 'All checks passed',
    files: ['manifest.json'],
    project: { root: '/app' },
  });

  it('signs manifest and can verify with same secret', () => {
    const manifest = createFullManifest();
    const secret = 'my-secret-key';

    const signed = signManifest(manifest, secret, 'key-001');

    expect(signed.signature).toBeDefined();
    expect(signed.signature!.algorithm).toBe('hmac-sha256');
    expect(signed.signature!.keyId).toBe('key-001');

    const verification = verifyManifestSignature(signed, secret);
    expect(verification.valid).toBe(true);
  });

  it('fails verification with wrong secret', () => {
    const manifest = createFullManifest();
    const signed = signManifest(manifest, 'correct-secret');

    const verification = verifyManifestSignature(signed, 'wrong-secret');
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain('Invalid signature');
  });

  it('fails verification when manifest is unsigned', () => {
    const manifest = createFullManifest();

    const verification = verifyManifestSignature(manifest, 'any-secret');
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain('not signed');
  });
});
