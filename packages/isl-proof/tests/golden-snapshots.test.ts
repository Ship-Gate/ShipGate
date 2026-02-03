/**
 * Golden Snapshot Tests for Verifier Output
 * 
 * These tests verify that the verifier produces consistent output
 * for known fixtures. Changes to output require explicit approval.
 * 
 * @module @isl-lang/isl-proof/tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parseISL } from '@isl-lang/isl-core';
import { verifyDomain, type TraceEvent, type VerificationResult } from '../src/verification-engine.js';
import { verifyProofBundle, formatVerificationResult } from '../src/verifier.js';
import { calculateSpecHash, calculateBundleId, type ProofBundleManifest } from '../src/manifest.js';

// ============================================================================
// Test Setup
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '../../../test-fixtures');
const SNAPSHOTS_DIR = path.join(__dirname, '__snapshots__');

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isl-golden-'));
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function loadFixture(relativePath: string): Promise<string | null> {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

function normalizeVerificationResult(result: VerificationResult): object {
  // Normalize for snapshot comparison (remove variable data like timestamps)
  return {
    verdict: result.verdict,
    summary: result.summary,
    evidenceCount: result.evidence.length,
    evidence: result.evidence.map(ev => ({
      clauseId: ev.clauseId,
      type: ev.type,
      behavior: ev.behavior,
      status: ev.evaluatedResult.status,
    })),
  };
}

async function createTestBundle(
  spec: string,
  specPath: string,
  verdict: 'PROVEN' | 'VIOLATED' | 'INCOMPLETE_PROOF' = 'PROVEN'
): Promise<string> {
  const specHash = calculateSpecHash(spec);
  const bundlePath = path.join(tempDir, `bundle-${Date.now()}`);
  
  await fs.mkdir(bundlePath, { recursive: true });
  await fs.mkdir(path.join(bundlePath, 'results'), { recursive: true });
  
  // Write spec
  await fs.writeFile(path.join(bundlePath, 'spec.isl'), spec);
  
  // Create manifest
  const manifest: Omit<ProofBundleManifest, 'bundleId'> = {
    schemaVersion: '2.0.0',
    generatedAt: '2026-02-02T00:00:00.000Z',
    spec: {
      domain: 'TestDomain',
      version: '1.0.0',
      specHash,
    },
    policyVersion: {
      bundleVersion: '1.0.0',
      islStudioVersion: '0.1.0',
      packs: [],
    },
    gateResult: {
      verdict: verdict === 'VIOLATED' ? 'NO_SHIP' : 'SHIP',
      score: verdict === 'PROVEN' ? 100 : verdict === 'INCOMPLETE_PROOF' ? 50 : 0,
      fingerprint: 'test-fingerprint',
      blockers: verdict === 'VIOLATED' ? 1 : 0,
      warnings: 0,
      violations: [],
      policyBundleVersion: '1.0.0',
      rulepackVersions: [],
      timestamp: '2026-02-02T00:00:00.000Z',
    },
    buildResult: {
      tool: 'test',
      toolVersion: '1.0.0',
      status: 'pass',
      errorCount: 0,
      warningCount: 0,
      durationMs: 100,
      timestamp: '2026-02-02T00:00:00.000Z',
    },
    testResult: {
      framework: 'vitest',
      frameworkVersion: '1.0.0',
      status: 'pass',
      totalTests: 10,
      passedTests: 10,
      failedTests: 0,
      skippedTests: 0,
      durationMs: 500,
      timestamp: '2026-02-02T00:00:00.000Z',
    },
    iterations: [],
    verdict,
    verdictReason: `Test bundle with verdict ${verdict}`,
    files: ['manifest.json', 'spec.isl'],
    project: { root: '/test' },
  };
  
  const manifestWithId = {
    ...manifest,
    bundleId: '', // Temporary
  } as ProofBundleManifest;
  
  manifestWithId.bundleId = calculateBundleId(manifestWithId);
  
  await fs.writeFile(
    path.join(bundlePath, 'manifest.json'),
    JSON.stringify(manifestWithId, null, 2)
  );
  
  return bundlePath;
}

// ============================================================================
// Golden Snapshot Tests - Valid Fixtures
// ============================================================================

describe('Golden Snapshots - Valid Fixtures', () => {
  it('should produce consistent output for minimal.isl', async () => {
    const content = await loadFixture('valid/minimal.isl');
    if (!content) {
      console.warn('Fixture not found: valid/minimal.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'minimal.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('minimal-verification');
  });

  it('should produce consistent output for complex-types.isl', async () => {
    const content = await loadFixture('valid/complex-types.isl');
    if (!content) {
      console.warn('Fixture not found: valid/complex-types.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'complex-types.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('complex-types-verification');
  });

  it('should produce consistent output for all-features.isl', async () => {
    const content = await loadFixture('valid/all-features.isl');
    if (!content) {
      console.warn('Fixture not found: valid/all-features.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'all-features.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('all-features-verification');
  });
});

// ============================================================================
// Golden Snapshot Tests - Real World Fixtures
// ============================================================================

describe('Golden Snapshots - Real World Fixtures', () => {
  it('should produce consistent output for auth.isl', async () => {
    const content = await loadFixture('valid/real-world/auth.isl');
    if (!content) {
      console.warn('Fixture not found: valid/real-world/auth.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'auth.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('auth-verification');
  });

  it('should produce consistent output for payment.isl', async () => {
    const content = await loadFixture('valid/real-world/payment.isl');
    if (!content) {
      console.warn('Fixture not found: valid/real-world/payment.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'payment.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('payment-verification');
  });

  it('should produce consistent output for crud.isl', async () => {
    const content = await loadFixture('valid/real-world/crud.isl');
    if (!content) {
      console.warn('Fixture not found: valid/real-world/crud.isl');
      return;
    }

    const { domain: ast, errors } = parseISL(content, 'crud.isl');
    expect(errors).toHaveLength(0);
    expect(ast).toBeDefined();

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('crud-verification');
  });
});

// ============================================================================
// Golden Snapshot Tests - Proof Bundle Output
// ============================================================================

describe('Golden Snapshots - Proof Bundle Verification', () => {
  it('should produce consistent output for PROVEN bundle', async () => {
    const spec = `
domain TestProven {
  version: "1.0.0"
  
  type UserId = UUID
  
  entity User {
    id: UserId [immutable]
    name: String
  }
  
  behavior CreateUser {
    input { name: String }
    output { success: User }
  }
}`;

    const bundlePath = await createTestBundle(spec, 'test.isl', 'PROVEN');
    const result = await verifyProofBundle(bundlePath);

    // Normalize for snapshot
    const normalized = {
      valid: result.valid,
      verdict: result.verdict,
      complete: result.complete,
      issueCount: result.issues.length,
      issueCodes: result.issues.map(i => i.code).sort(),
    };

    expect(normalized).toMatchSnapshot('proven-bundle-verification');
  });

  it('should produce consistent output for INCOMPLETE_PROOF bundle', async () => {
    const spec = `
domain TestIncomplete {
  version: "1.0.0"
  
  entity Item {
    id: UUID [immutable]
  }
}`;

    const bundlePath = await createTestBundle(spec, 'test.isl', 'INCOMPLETE_PROOF');
    const result = await verifyProofBundle(bundlePath);

    const normalized = {
      valid: result.valid,
      verdict: result.verdict,
      complete: result.complete,
      issueCount: result.issues.length,
      issueCodes: result.issues.map(i => i.code).sort(),
    };

    expect(normalized).toMatchSnapshot('incomplete-bundle-verification');
  });

  it('should produce consistent formatted output', async () => {
    const spec = `
domain TestFormat {
  version: "1.0.0"
}`;

    const bundlePath = await createTestBundle(spec, 'test.isl', 'PROVEN');
    const result = await verifyProofBundle(bundlePath);
    const formatted = formatVerificationResult(result);

    // Verify key elements are present
    expect(formatted).toContain('VALID');
    expect(formatted).toContain('PROVEN');
  });
});

// ============================================================================
// Golden Snapshot Tests - Edge Cases
// ============================================================================

describe('Golden Snapshots - Edge Cases', () => {
  it('should handle empty behaviors consistently', async () => {
    const spec = `
domain EmptyBehaviors {
  version: "1.0.0"
  
  entity Empty {
    id: UUID [immutable]
  }
}`;

    const { domain: ast, errors } = parseISL(spec, 'empty.isl');
    expect(errors).toHaveLength(0);

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('empty-behaviors-verification');
  });

  it('should handle complex constraints consistently', async () => {
    const spec = `
domain ComplexConstraints {
  version: "1.0.0"
  
  type PositiveInt = Int { min: 1 }
  type BoundedString = String { minLength: 1, maxLength: 100 }
  
  entity Order {
    id: UUID [immutable]
    quantity: PositiveInt
    description: BoundedString
  }
  
  invariant QuantityPositive {
    description: "Quantity must be positive"
    condition: all(o in Order: o.quantity > 0)
  }
}`;

    const { domain: ast, errors } = parseISL(spec, 'constraints.isl');
    expect(errors).toHaveLength(0);

    const result = await verifyDomain(ast!, []);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('complex-constraints-verification');
  });

  it('should handle trace events consistently', async () => {
    const spec = `
domain WithTraces {
  version: "1.0.0"
  
  entity Counter {
    id: UUID [immutable]
    value: Int
  }
  
  behavior Increment {
    precondition: input.amount > 0
    postcondition: result.value == old.value + input.amount
    input { amount: Int }
    output { success: Counter }
  }
}`;

    const traces: TraceEvent[] = [
      {
        type: 'behavior_call',
        behaviorName: 'Increment',
        timestamp: Date.now(),
        input: { amount: 5 },
        output: { success: { id: '123', value: 10 } },
        preState: { value: 5 },
        postState: { value: 10 },
      },
    ];

    const { domain: ast, errors } = parseISL(spec, 'traces.isl');
    expect(errors).toHaveLength(0);

    const result = await verifyDomain(ast!, traces);
    const normalized = normalizeVerificationResult(result);

    expect(normalized).toMatchSnapshot('with-traces-verification');
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe('Verification Output Regression', () => {
  it('should maintain backward compatibility in verdict structure', async () => {
    const spec = `
domain CompatTest {
  version: "1.0.0"
  
  behavior TestBehavior {
    input { value: String }
    output { success: String }
  }
}`;

    const { domain: ast } = parseISL(spec, 'compat.isl');
    const result = await verifyDomain(ast!, []);

    // These fields must always exist
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('evidence');
    
    // Summary must have these fields
    expect(result.summary).toHaveProperty('totalClauses');
    expect(result.summary).toHaveProperty('provenClauses');
    expect(result.summary).toHaveProperty('notProvenClauses');
    expect(result.summary).toHaveProperty('failedClauses');
    expect(result.summary).toHaveProperty('incompleteClauses');
    
    // Verdict must be valid enum
    expect(['PROVEN', 'NOT_PROVEN', 'VIOLATED', 'INCOMPLETE_PROOF']).toContain(result.verdict);
  });

  it('should maintain backward compatibility in evidence structure', async () => {
    const spec = `
domain EvidenceCompat {
  version: "1.0.0"
  
  behavior TestEvidence {
    precondition: input.value != null
    postcondition: result != null
    input { value: String }
    output { success: String }
  }
}`;

    const traces: TraceEvent[] = [
      {
        type: 'behavior_call',
        behaviorName: 'TestEvidence',
        timestamp: Date.now(),
        input: { value: 'test' },
        output: { success: 'result' },
      },
    ];

    const { domain: ast } = parseISL(spec, 'evidence.isl');
    const result = await verifyDomain(ast!, traces);

    // Each evidence item must have these fields
    for (const ev of result.evidence) {
      expect(ev).toHaveProperty('clauseId');
      expect(ev).toHaveProperty('type');
      expect(ev).toHaveProperty('sourceSpan');
      expect(ev).toHaveProperty('evaluatedResult');
      
      // evaluatedResult must have status
      expect(ev.evaluatedResult).toHaveProperty('status');
      expect(['proven', 'not_proven', 'failed']).toContain(ev.evaluatedResult.status);
    }
  });
});
