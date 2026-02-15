/**
 * Tests for Proof Bundle Gate
 *
 * - Snapshot JSON output for a fixture
 * - Determinism: same input => same output bytes
 */

import { describe, it, expect } from 'vitest';
import {
  createProofBundleGate,
  createProofBundleGateWithHash,
  proofBundleGateHash,
  serializeProofBundleGate,
  stableSortResults,
  mapClauseStatusToResultStatus,
  mapSeverity,
  PROOF_BUNDLE_GATE_SCHEMA_VERSION,
  type ProofBundleGateResult,
} from '../src/proof-bundle-gate.js';

// ============================================================================
// Fixtures
// ============================================================================

const FIXED_TIMESTAMP = '2026-02-14T12:00:00.000Z';

const FIXTURE_RESULTS: ProofBundleGateResult[] = [
  { category: 'auth', checkId: 'auth/bypass-detected', severity: 'critical', status: 'pass' },
  { category: 'auth', checkId: 'auth/hardcoded-credentials', severity: 'high', status: 'pass' },
  { category: 'pii', checkId: 'pii/logged-sensitive-data', severity: 'medium', status: 'fail', evidenceRefs: ['src/api.ts:42'] },
  { category: 'payments', checkId: 'payments/client-side-amount', severity: 'high', status: 'pass' },
];

function makeFixtureInput(overrides: Partial<Parameters<typeof createProofBundleGate>[0]> = {}) {
  return {
    toolVersion: '2.0.0',
    timestamp: FIXED_TIMESTAMP,
    configDigest: 'a'.repeat(64),
    results: FIXTURE_RESULTS,
    verdict: 'NO_SHIP' as const,
    score: 75,
    ...overrides,
  };
}

// ============================================================================
// Snapshot test
// ============================================================================

describe('proof-bundle-gate snapshot', () => {
  it('produces stable JSON output for fixture', () => {
    const input = makeFixtureInput();
    const raw = createProofBundleGate(input);
    const bundle = createProofBundleGateWithHash(raw);
    const json = serializeProofBundleGate(bundle);
    expect(json).toMatchSnapshot();
  });

  it('includes schemaVersion 1.0.0', () => {
    const raw = createProofBundleGate(makeFixtureInput());
    const bundle = createProofBundleGateWithHash(raw);
    expect(bundle.schemaVersion).toBe(PROOF_BUNDLE_GATE_SCHEMA_VERSION);
  });

  it('includes all required fields', () => {
    const raw = createProofBundleGate(makeFixtureInput());
    const bundle = createProofBundleGateWithHash(raw);
    expect(bundle).toHaveProperty('schemaVersion');
    expect(bundle).toHaveProperty('toolVersion');
    expect(bundle).toHaveProperty('timestamp');
    expect(bundle).toHaveProperty('configDigest');
    expect(bundle).toHaveProperty('results');
    expect(bundle).toHaveProperty('verdict');
    expect(bundle).toHaveProperty('score');
    expect(bundle).toHaveProperty('bundleHash');
  });
});

// ============================================================================
// Determinism test
// ============================================================================

describe('proof-bundle-gate determinism', () => {
  it('same input => same output bytes', () => {
    const input = makeFixtureInput();
    const b1 = createProofBundleGateWithHash(createProofBundleGate(input));
    const b2 = createProofBundleGateWithHash(createProofBundleGate(input));
    const json1 = serializeProofBundleGate(b1);
    const json2 = serializeProofBundleGate(b2);
    expect(json1).toBe(json2);
    expect(Buffer.from(json1, 'utf8').equals(Buffer.from(json2, 'utf8'))).toBe(true);
  });

  it('same input => same bundleHash', () => {
    const input = makeFixtureInput();
    const b1 = createProofBundleGateWithHash(createProofBundleGate(input));
    const b2 = createProofBundleGateWithHash(createProofBundleGate(input));
    expect(b1.bundleHash).toBe(b2.bundleHash);
  });

  it('results are stable-sorted regardless of input order', () => {
    const unsorted: ProofBundleGateResult[] = [
      { category: 'z', checkId: 'z/check', severity: 'low', status: 'pass' },
      { category: 'a', checkId: 'a/check', severity: 'high', status: 'fail' },
    ];
    const sorted = stableSortResults(unsorted);
    expect(sorted[0].category).toBe('a');
    expect(sorted[1].category).toBe('z');
  });
});

// ============================================================================
// Helpers
// ============================================================================

describe('mapClauseStatusToResultStatus', () => {
  it('maps passed -> pass', () => expect(mapClauseStatusToResultStatus('passed')).toBe('pass'));
  it('maps failed -> fail', () => expect(mapClauseStatusToResultStatus('failed')).toBe('fail'));
  it('maps skipped -> skip', () => expect(mapClauseStatusToResultStatus('skipped')).toBe('skip'));
  it('maps unknown -> unknown', () => expect(mapClauseStatusToResultStatus('x')).toBe('unknown'));
});

describe('mapSeverity', () => {
  it('maps critical', () => expect(mapSeverity('critical')).toBe('critical'));
  it('maps high', () => expect(mapSeverity('high')).toBe('high'));
  it('maps unknown to info', () => expect(mapSeverity('x')).toBe('info'));
});
