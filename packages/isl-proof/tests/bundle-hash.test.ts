/**
 * Tests for ProofBundle v1 — deterministic, hashable, verifiable bundles
 * 
 * Acceptance criteria:
 *   1. Re-running bundle creation on same input yields identical hash
 *   2. Verification fails if any artifact is modified
 */

import { describe, it, expect } from 'vitest';
import {
  createBundle,
  verifyBundle,
  bundleHash,
  serializeBundle,
  parseBundle,
  type CreateBundleInput,
  type ProofBundleV1,
  type BundleClaim,
  type BundleVerdictArtifact,
  type BundleTraceRef,
  type BundleEvidence,
} from '../src/bundle-hash.js';
import {
  canonicalJsonStringify,
  canonicalJsonCompact,
  normalizeJson,
} from '../src/canonical-json.js';

// ============================================================================
// Fixtures
// ============================================================================

const FIXED_TIMESTAMP = '2026-02-09T00:00:00.000Z';

function makeSampleInput(overrides: Partial<CreateBundleInput> = {}): CreateBundleInput {
  return {
    spec: {
      domain: 'Auth',
      version: '1.0.0',
      specHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
      specPath: '../specs/auth.isl',
    },
    verdicts: [
      {
        phase: 'gate',
        verdict: 'SHIP',
        score: 100,
        details: { blockers: 0, warnings: 0 },
        timestamp: FIXED_TIMESTAMP,
      },
      {
        phase: 'build',
        verdict: 'pass',
        details: { errorCount: 0, warningCount: 0 },
        timestamp: FIXED_TIMESTAMP,
      },
      {
        phase: 'test',
        verdict: 'pass',
        score: 5,
        details: { totalTests: 5, passedTests: 5, failedTests: 0 },
        timestamp: FIXED_TIMESTAMP,
      },
    ],
    claims: [
      {
        clauseId: 'login:postcondition:1',
        clauseType: 'postcondition',
        behavior: 'login',
        status: 'proven',
        reason: 'All assertions pass',
        traceIds: ['trace-1'],
      },
      {
        clauseId: 'login:precondition:1',
        clauseType: 'precondition',
        behavior: 'login',
        status: 'proven',
        reason: 'Input validated',
      },
    ],
    traces: [
      {
        traceId: 'trace-1',
        behavior: 'login',
        testName: 'login.test.ts',
        tracePath: 'traces/trace-1.json',
        eventCount: 42,
      },
    ],
    evidence: [
      {
        clauseId: 'login:postcondition:1',
        evidenceType: 'test',
        satisfied: true,
        confidence: 0.95,
      },
      {
        clauseId: 'login:precondition:1',
        evidenceType: 'static_analysis',
        satisfied: true,
        confidence: 0.9,
      },
    ],
    createdAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

// ============================================================================
// Canonical JSON Tests
// ============================================================================

describe('canonicalJsonStringify', () => {
  it('sorts object keys at all depth levels', () => {
    const obj = { z: 1, a: { c: 3, b: 2 } };
    const result = canonicalJsonStringify(obj);
    const parsed = JSON.parse(result);

    // Keys should be sorted
    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.a)).toEqual(['b', 'c']);
  });

  it('produces identical output regardless of key insertion order', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, m: 3, z: 1 };
    const obj3 = { m: 3, z: 1, a: 2 };

    const r1 = canonicalJsonStringify(obj1);
    const r2 = canonicalJsonStringify(obj2);
    const r3 = canonicalJsonStringify(obj3);

    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('normalizes line endings to LF', () => {
    const obj = { text: 'hello\r\nworld\rfoo\nbar' };
    const result = canonicalJsonStringify(obj);

    expect(result).not.toContain('\r');
    expect(result).toContain('hello\\nworld\\nfoo\\nbar');
  });

  it('converts NaN and Infinity to null', () => {
    const obj = { a: NaN, b: Infinity, c: -Infinity, d: 42 };
    const result = canonicalJsonStringify(obj);
    const parsed = JSON.parse(result);

    expect(parsed.a).toBe(null);
    expect(parsed.b).toBe(null);
    expect(parsed.c).toBe(null);
    expect(parsed.d).toBe(42);
  });

  it('omits undefined values', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    const result = canonicalJsonStringify(obj);
    const parsed = JSON.parse(result);

    expect(Object.keys(parsed)).toEqual(['a', 'c']);
  });

  it('preserves array order', () => {
    const obj = { items: [3, 1, 2] };
    const result = canonicalJsonStringify(obj);
    const parsed = JSON.parse(result);

    expect(parsed.items).toEqual([3, 1, 2]);
  });

  it('handles deeply nested structures', () => {
    const obj = {
      z: { y: { x: { w: 1 } } },
      a: { b: { c: { d: 2 } } },
    };
    const result = canonicalJsonStringify(obj);
    const parsed = JSON.parse(result);

    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    expect(parsed.a.b.c.d).toBe(2);
    expect(parsed.z.y.x.w).toBe(1);
  });

  it('ends with a trailing newline', () => {
    const result = canonicalJsonStringify({ a: 1 });
    expect(result.endsWith('\n')).toBe(true);
  });
});

describe('canonicalJsonCompact', () => {
  it('produces no whitespace', () => {
    const obj = { z: 1, a: 2 };
    const result = canonicalJsonCompact(obj);

    expect(result).toBe('{"a":2,"z":1}');
  });
});

describe('normalizeJson', () => {
  it('re-serializes JSON canonically', () => {
    const input = '{"z":1,"a":{"c":3,"b":2}}';
    const result = normalizeJson(input);
    const parsed = JSON.parse(result);

    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.a)).toEqual(['b', 'c']);
  });
});

// ============================================================================
// createBundle Tests
// ============================================================================

describe('createBundle', () => {
  it('creates a valid bundle with all fields populated', () => {
    const input = makeSampleInput();
    const bundle = createBundle(input);

    expect(bundle.schemaVersion).toBe('1.0.0');
    expect(bundle.bundleHash).toBeTruthy();
    expect(bundle.bundleHash).toHaveLength(64); // SHA-256 hex
    expect(bundle.spec.domain).toBe('Auth');
    expect(bundle.verdicts).toHaveLength(3);
    expect(bundle.claims).toHaveLength(2);
    expect(bundle.traces).toHaveLength(1);
    expect(bundle.evidence).toHaveLength(2);
    expect(bundle.createdAt).toBe(FIXED_TIMESTAMP);
  });

  it('derives PROVEN verdict when all claims proven and phases pass', () => {
    const input = makeSampleInput();
    const bundle = createBundle(input);

    expect(bundle.verdict).toBe('PROVEN');
    expect(bundle.verdictReason).toContain('proven');
  });

  it('derives VIOLATED verdict when a claim is violated', () => {
    const input = makeSampleInput({
      claims: [
        {
          clauseId: 'login:postcondition:1',
          clauseType: 'postcondition',
          behavior: 'login',
          status: 'violated',
          reason: 'Assertion failed',
        },
      ],
    });
    const bundle = createBundle(input);

    expect(bundle.verdict).toBe('VIOLATED');
    expect(bundle.verdictReason).toContain('violated');
  });

  it('derives VIOLATED verdict when gate is NO_SHIP', () => {
    const input = makeSampleInput({
      verdicts: [
        {
          phase: 'gate',
          verdict: 'NO_SHIP',
          score: 30,
          details: { blockers: 3, warnings: 1 },
          timestamp: FIXED_TIMESTAMP,
        },
      ],
      claims: [
        {
          clauseId: 'login:postcondition:1',
          clauseType: 'postcondition',
          behavior: 'login',
          status: 'proven',
        },
      ],
    });
    const bundle = createBundle(input);

    expect(bundle.verdict).toBe('VIOLATED');
    expect(bundle.verdictReason).toContain('NO_SHIP');
  });

  it('derives INCOMPLETE_PROOF when claims are unknown', () => {
    const input = makeSampleInput({
      claims: [
        {
          clauseId: 'login:postcondition:1',
          clauseType: 'postcondition',
          behavior: 'login',
          status: 'unknown',
          reason: 'No trace data',
        },
      ],
    });
    const bundle = createBundle(input);

    expect(bundle.verdict).toBe('INCOMPLETE_PROOF');
    expect(bundle.verdictReason).toContain('unknown');
  });

  it('derives UNPROVEN when there are no claims', () => {
    const input = makeSampleInput({ claims: [] });
    const bundle = createBundle(input);

    expect(bundle.verdict).toBe('UNPROVEN');
    expect(bundle.verdictReason).toContain('No claims');
  });

  it('signs bundle when signSecret is provided', () => {
    const input = makeSampleInput({ signSecret: 'test-secret-key' });
    const bundle = createBundle(input);

    expect(bundle.signature).toBeTruthy();
    expect(bundle.signature).toHaveLength(64); // HMAC-SHA256 hex
  });

  it('does not include signature when signSecret is omitted', () => {
    const input = makeSampleInput();
    const bundle = createBundle(input);

    expect(bundle.signature).toBeUndefined();
  });
});

// ============================================================================
// Acceptance Criterion 1: Deterministic Hash
// ============================================================================

describe('Deterministic Hash (AC-1)', () => {
  it('re-running bundle creation on same input yields identical hash', () => {
    const input = makeSampleInput();

    const bundle1 = createBundle(input);
    const bundle2 = createBundle(input);

    expect(bundle1.bundleHash).toBe(bundle2.bundleHash);
  });

  it('hash is stable across 100 iterations', () => {
    const input = makeSampleInput();
    const hashes = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const bundle = createBundle(input);
      hashes.add(bundle.bundleHash);
    }

    expect(hashes.size).toBe(1);
  });

  it('identical inputs with different key order produce same hash', () => {
    const input1 = makeSampleInput();
    const input2: CreateBundleInput = {
      createdAt: input1.createdAt,
      evidence: input1.evidence,
      claims: input1.claims,
      traces: input1.traces,
      verdicts: input1.verdicts,
      spec: input1.spec,
    };

    const bundle1 = createBundle(input1);
    const bundle2 = createBundle(input2);

    expect(bundle1.bundleHash).toBe(bundle2.bundleHash);
  });

  it('signed bundles also have deterministic hashes', () => {
    const input = makeSampleInput({ signSecret: 'my-secret' });

    const bundle1 = createBundle(input);
    const bundle2 = createBundle(input);

    expect(bundle1.bundleHash).toBe(bundle2.bundleHash);
    expect(bundle1.signature).toBe(bundle2.signature);
  });

  it('different inputs produce different hashes', () => {
    const input1 = makeSampleInput();
    const input2 = makeSampleInput({
      spec: { domain: 'Payments', version: '2.0.0', specHash: 'different-hash-value-here-00000000000000000000000000000000' },
    });

    const bundle1 = createBundle(input1);
    const bundle2 = createBundle(input2);

    expect(bundle1.bundleHash).not.toBe(bundle2.bundleHash);
  });

  it('bundleHash() is consistent with createBundle()', () => {
    const input = makeSampleInput();
    const bundle = createBundle(input);

    // Re-derive hash from the bundle object
    const recomputed = bundleHash(bundle);
    expect(recomputed).toBe(bundle.bundleHash);
  });
});

// ============================================================================
// Acceptance Criterion 2: Tamper Detection
// ============================================================================

describe('Tamper Detection (AC-2)', () => {
  it('verification passes for an unmodified bundle', () => {
    const bundle = createBundle(makeSampleInput());
    const result = verifyBundle(bundle);

    expect(result.valid).toBe(true);
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('verification fails if spec domain is modified', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered = { ...bundle, spec: { ...bundle.spec, domain: 'Tampered' } };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
    const hashCheck = result.checks.find(c => c.name === 'hash_integrity');
    expect(hashCheck?.passed).toBe(false);
  });

  it('verification fails if a claim status is changed', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      claims: bundle.claims.map((c, i) =>
        i === 0 ? { ...c, status: 'violated' as const } : c,
      ),
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
    const hashCheck = result.checks.find(c => c.name === 'hash_integrity');
    expect(hashCheck?.passed).toBe(false);
  });

  it('verification fails if verdict is manually changed', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = { ...bundle, verdict: 'VIOLATED' };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
    // Both hash and verdict consistency should fail
    const hashCheck = result.checks.find(c => c.name === 'hash_integrity');
    const verdictCheck = result.checks.find(c => c.name === 'verdict_consistency');
    expect(hashCheck?.passed).toBe(false);
    expect(verdictCheck?.passed).toBe(false);
  });

  it('verification fails if evidence confidence is changed', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      evidence: bundle.evidence.map((e, i) =>
        i === 0 ? { ...e, confidence: 0.1 } : e,
      ),
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });

  it('verification fails if a trace is added', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      traces: [
        ...bundle.traces,
        {
          traceId: 'injected-trace',
          behavior: 'logout',
          testName: 'fake.test.ts',
          tracePath: 'traces/fake.json',
          eventCount: 1,
        },
      ],
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });

  it('verification fails if a trace is removed', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      traces: [],
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });

  it('verification fails if timestamp is altered', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = { ...bundle, createdAt: '2099-01-01T00:00:00.000Z' };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });

  it('verification fails if bundleHash is zeroed out', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      bundleHash: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });

  it('verification fails if a verdict phase score is changed', () => {
    const bundle = createBundle(makeSampleInput());
    const tampered: ProofBundleV1 = {
      ...bundle,
      verdicts: bundle.verdicts.map((v, i) =>
        i === 0 ? { ...v, score: 50 } : v,
      ),
    };

    const result = verifyBundle(tampered);

    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Signature Verification
// ============================================================================

describe('Signature Verification', () => {
  it('verifies valid signature with correct secret', () => {
    const bundle = createBundle(makeSampleInput({ signSecret: 'my-secret' }));
    const result = verifyBundle(bundle, { signSecret: 'my-secret' });

    expect(result.valid).toBe(true);
    expect(result.signatureValid).toBe(true);
  });

  it('fails with wrong secret', () => {
    const bundle = createBundle(makeSampleInput({ signSecret: 'my-secret' }));
    const result = verifyBundle(bundle, { signSecret: 'wrong-secret' });

    expect(result.valid).toBe(false);
    expect(result.signatureValid).toBe(false);
    const sigCheck = result.checks.find(c => c.name === 'signature');
    expect(sigCheck?.passed).toBe(false);
  });

  it('skips signature check when no secret provided', () => {
    const bundle = createBundle(makeSampleInput({ signSecret: 'my-secret' }));
    const result = verifyBundle(bundle);

    // Should still pass — signature check is skipped, not failed
    const sigCheck = result.checks.find(c => c.name === 'signature');
    expect(sigCheck?.passed).toBe(true);
    expect(sigCheck?.message).toContain('skipping');
  });
});

// ============================================================================
// Serialization Round-Trip
// ============================================================================

describe('Serialization Round-Trip', () => {
  it('serializeBundle → parseBundle preserves hash', () => {
    const bundle = createBundle(makeSampleInput());
    const json = serializeBundle(bundle);
    const restored = parseBundle(json);

    expect(restored.bundleHash).toBe(bundle.bundleHash);
    expect(bundleHash(restored)).toBe(bundle.bundleHash);
  });

  it('serialized bundle verifies after round-trip', () => {
    const bundle = createBundle(makeSampleInput({ signSecret: 'key' }));
    const json = serializeBundle(bundle);
    const restored = parseBundle(json);

    const result = verifyBundle(restored, { signSecret: 'key' });
    expect(result.valid).toBe(true);
  });

  it('parseBundle rejects invalid JSON', () => {
    expect(() => parseBundle('not json')).toThrow();
  });

  it('parseBundle rejects wrong schema version', () => {
    const json = JSON.stringify({ schemaVersion: '99.0.0', bundleHash: 'x' });
    expect(() => parseBundle(json)).toThrow('Unsupported');
  });

  it('parseBundle rejects missing bundleHash', () => {
    const json = JSON.stringify({ schemaVersion: '1.0.0' });
    expect(() => parseBundle(json)).toThrow('missing bundleHash');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty arrays for all artifact fields', () => {
    const input = makeSampleInput({
      verdicts: [],
      claims: [],
      traces: [],
      evidence: [],
    });
    const bundle = createBundle(input);

    expect(bundle.bundleHash).toHaveLength(64);
    expect(bundle.verdict).toBe('UNPROVEN');

    const result = verifyBundle(bundle);
    expect(result.valid).toBe(true);
  });

  it('handles claims with optional fields omitted', () => {
    const input = makeSampleInput({
      claims: [
        {
          clauseId: 'minimal:claim',
          clauseType: 'intent',
          status: 'proven',
        },
      ],
    });
    const bundle = createBundle(input);

    expect(bundle.bundleHash).toHaveLength(64);
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(true);
  });

  it('handles special characters in string fields', () => {
    const input = makeSampleInput({
      spec: {
        domain: 'Auth "Special" <Chars> & More',
        version: '1.0.0-beta+build.123',
        specHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
      },
    });
    const bundle = createBundle(input);

    const result = verifyBundle(bundle);
    expect(result.valid).toBe(true);
  });

  it('handles unicode in fields', () => {
    const input = makeSampleInput({
      claims: [
        {
          clauseId: 'unicode:test:🔐',
          clauseType: 'invariant',
          status: 'proven',
          reason: '認証は有効です (authentication is valid)',
        },
      ],
    });
    const bundle = createBundle(input);

    const bundle2 = createBundle(input);
    expect(bundle.bundleHash).toBe(bundle2.bundleHash);

    const result = verifyBundle(bundle);
    expect(result.valid).toBe(true);
  });

  it('handles very large bundles', () => {
    const claims: BundleClaim[] = [];
    const evidence: BundleEvidence[] = [];
    for (let i = 0; i < 500; i++) {
      claims.push({
        clauseId: `clause:${i}`,
        clauseType: 'postcondition',
        behavior: `behavior-${i}`,
        status: 'proven',
        reason: `Proven by test ${i}`,
      });
      evidence.push({
        clauseId: `clause:${i}`,
        evidenceType: 'test',
        satisfied: true,
        confidence: 0.95,
      });
    }

    const input = makeSampleInput({ claims, evidence });
    const bundle1 = createBundle(input);
    const bundle2 = createBundle(input);

    expect(bundle1.bundleHash).toBe(bundle2.bundleHash);
    expect(bundle1.verdict).toBe('PROVEN');
  });
});
