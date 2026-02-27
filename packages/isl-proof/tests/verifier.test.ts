/**
 * Tests for ISL Proof Bundle Verifier
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  verifyProofBundle,
  formatVerificationResult,
  isValidBundle,
  isProvenEnough,
} from '../src/verifier.js';
import {
  calculateBundleId,
  calculateSpecHash,
  signManifest,
  type ProofBundleManifest,
} from '../src/manifest.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createValidManifest = (): Omit<ProofBundleManifest, 'bundleId'> => ({
  schemaVersion: '2.0.0',
  generatedAt: '2026-02-02T00:00:00.000Z',
  spec: {
    domain: 'auth',
    version: '1.0.0',
    specHash: '', // Will be calculated
  },
  policyVersion: {
    bundleVersion: '1.0.0',
    shipgateVersion: '0.1.0',
    packs: [{ id: 'auth', version: '1.0.0', rulesCount: 5 }],
  },
  gateResult: {
    verdict: 'SHIP',
    score: 100,
    fingerprint: 'abc123',
    blockers: 0,
    warnings: 0,
    violations: [],
    policyBundleVersion: '1.0.0',
    rulepackVersions: [{ id: 'auth', version: '1.0.0', rulesCount: 5 }],
    timestamp: '2026-02-02T00:00:00.000Z',
  },
  buildResult: {
    tool: 'tsc',
    toolVersion: '5.3.0',
    status: 'pass',
    errorCount: 0,
    warningCount: 0,
    durationMs: 1000,
    timestamp: '2026-02-02T00:00:00.000Z',
  },
  testResult: {
    framework: 'vitest',
    frameworkVersion: '1.2.0',
    status: 'pass',
    totalTests: 10,
    passedTests: 10,
    failedTests: 0,
    skippedTests: 0,
    durationMs: 2000,
    timestamp: '2026-02-02T00:00:00.000Z',
  },
  iterations: [],
  verdict: 'PROVEN',
  verdictReason: 'All checks passed',
  files: ['manifest.json', 'spec.isl', 'results/gate.json'],
  project: { root: '/app' },
});

// ============================================================================
// Test Setup
// ============================================================================

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isl-proof-test-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function createTestBundle(
  manifestOverrides: Partial<ProofBundleManifest> = {},
  options: { includeSpec?: boolean; includeFiles?: boolean } = {}
): Promise<string> {
  const { includeSpec = true, includeFiles = true } = options;
  
  const specContent = 'domain Auth version "1.0.0" {}';
  const specHash = calculateSpecHash(specContent);
  
  const baseManifest = createValidManifest();
  baseManifest.spec.specHash = specHash;
  
  const manifestWithId = {
    ...baseManifest,
    ...manifestOverrides,
    bundleId: '', // Temporary
  } as ProofBundleManifest;
  
  // Calculate bundle ID
  const bundleId = calculateBundleId(manifestWithId);
  manifestWithId.bundleId = bundleId;
  
  // Create bundle directory
  const bundlePath = path.join(tempDir, 'test-bundle');
  await fs.mkdir(bundlePath, { recursive: true });
  await fs.mkdir(path.join(bundlePath, 'results'), { recursive: true });
  
  // Write manifest
  await fs.writeFile(
    path.join(bundlePath, 'manifest.json'),
    JSON.stringify(manifestWithId, null, 2)
  );
  
  // Write spec
  if (includeSpec) {
    await fs.writeFile(path.join(bundlePath, 'spec.isl'), specContent);
  }
  
  // Write other files
  if (includeFiles) {
    await fs.writeFile(
      path.join(bundlePath, 'results', 'gate.json'),
      JSON.stringify(manifestWithId.gateResult, null, 2)
    );
  }
  
  return bundlePath;
}

// ============================================================================
// verifyProofBundle Tests
// ============================================================================

describe('verifyProofBundle', () => {
  it('validates a correct proof bundle', async () => {
    const bundlePath = await createTestBundle();
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.valid).toBe(true);
    expect(result.verdict).toBe('PROVEN');
    expect(result.complete).toBe(true);
    expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('fails when manifest is missing', async () => {
    const bundlePath = path.join(tempDir, 'empty-bundle');
    await fs.mkdir(bundlePath, { recursive: true });
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'MANIFEST_MISSING')).toBe(true);
  });

  it('detects tampered bundle ID', async () => {
    const bundlePath = await createTestBundle();
    
    // Tamper with the manifest
    const manifestPath = path.join(bundlePath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    manifest.bundleId = 'tampered-id';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'BUNDLE_ID_MISMATCH')).toBe(true);
  });

  it('detects verdict mismatch', async () => {
    const bundlePath = await createTestBundle({
      verdict: 'PROVEN',
      gateResult: {
        verdict: 'NO_SHIP', // Should cause VIOLATED verdict
        score: 50,
        fingerprint: 'xyz',
        blockers: 2,
        warnings: 0,
        violations: [],
        policyBundleVersion: '1.0.0',
        rulepackVersions: [],
        timestamp: '2026-02-02T00:00:00.000Z',
      },
    });
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'VERDICT_MISMATCH')).toBe(true);
  });

  it('detects spec hash mismatch', async () => {
    const bundlePath = await createTestBundle();
    
    // Modify the spec file
    await fs.writeFile(path.join(bundlePath, 'spec.isl'), 'domain Modified {}');
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'SPEC_HASH_MISMATCH')).toBe(true);
  });

  it('detects missing files', async () => {
    const bundlePath = await createTestBundle({}, { includeFiles: false });
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.complete).toBe(false);
    expect(result.issues.some(i => i.code === 'FILE_MISSING')).toBe(true);
  });

  it('warns about INCOMPLETE_PROOF verdict', async () => {
    const bundlePath = await createTestBundle({
      verdict: 'INCOMPLETE_PROOF',
      verdictReason: 'No tests',
      testResult: {
        framework: 'vitest',
        frameworkVersion: '1.2.0',
        status: 'no_tests',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 0,
        timestamp: '2026-02-02T00:00:00.000Z',
      },
    });
    
    const result = await verifyProofBundle(bundlePath);
    
    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.issues.some(i => i.code === 'INCOMPLETE_PROOF')).toBe(true);
    expect(result.issues.find(i => i.code === 'INCOMPLETE_PROOF')?.severity).toBe('warning');
  });

  it('verifies signature with correct secret', async () => {
    const bundlePath = await createTestBundle();
    const secret = 'test-secret';
    
    // Sign the manifest
    const manifestPath = path.join(bundlePath, 'manifest.json');
    let manifest: ProofBundleManifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    manifest = signManifest(manifest, secret);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    const result = await verifyProofBundle(bundlePath, { signSecret: secret });
    
    expect(result.signatureValid).toBe(true);
  });

  it('fails signature verification with wrong secret', async () => {
    const bundlePath = await createTestBundle();
    
    // Sign with one secret
    const manifestPath = path.join(bundlePath, 'manifest.json');
    let manifest: ProofBundleManifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    manifest = signManifest(manifest, 'correct-secret');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Verify with different secret
    const result = await verifyProofBundle(bundlePath, { signSecret: 'wrong-secret' });
    
    expect(result.signatureValid).toBe(false);
    expect(result.issues.some(i => i.code === 'SIGNATURE_INVALID')).toBe(true);
  });

  it('can skip file check', async () => {
    const bundlePath = await createTestBundle({}, { includeFiles: false });
    
    const result = await verifyProofBundle(bundlePath, { skipFileCheck: true });
    
    // Should not complain about missing files
    expect(result.issues.filter(i => i.code === 'FILE_MISSING')).toHaveLength(0);
  });
});

// ============================================================================
// formatVerificationResult Tests
// ============================================================================

describe('formatVerificationResult', () => {
  it('formats valid result', async () => {
    const bundlePath = await createTestBundle();
    const result = await verifyProofBundle(bundlePath);
    
    const formatted = formatVerificationResult(result);
    
    expect(formatted).toContain('VALID');
    expect(formatted).toContain('PROVEN');
    expect(formatted).toContain('auth');
  });

  it('formats invalid result with issues', async () => {
    const bundlePath = await createTestBundle();
    
    // Tamper with manifest
    const manifestPath = path.join(bundlePath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    manifest.bundleId = 'tampered';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    const result = await verifyProofBundle(bundlePath);
    const formatted = formatVerificationResult(result);
    
    expect(formatted).toContain('INVALID');
    expect(formatted).toContain('BUNDLE_ID_MISMATCH');
  });
});

// ============================================================================
// isValidBundle Tests
// ============================================================================

describe('isValidBundle', () => {
  it('returns true for valid bundle', async () => {
    const bundlePath = await createTestBundle();
    
    const valid = await isValidBundle(bundlePath);
    
    expect(valid).toBe(true);
  });

  it('returns false for invalid bundle', async () => {
    const bundlePath = path.join(tempDir, 'nonexistent');
    
    const valid = await isValidBundle(bundlePath);
    
    expect(valid).toBe(false);
  });
});

// ============================================================================
// isProvenEnough Tests
// ============================================================================

describe('isProvenEnough', () => {
  it('returns true for PROVEN', () => {
    expect(isProvenEnough('PROVEN')).toBe(true);
  });

  it('returns false for VIOLATED', () => {
    expect(isProvenEnough('VIOLATED')).toBe(false);
  });

  it('returns false for INCOMPLETE_PROOF by default', () => {
    expect(isProvenEnough('INCOMPLETE_PROOF')).toBe(false);
  });

  it('returns true for INCOMPLETE_PROOF with allowIncomplete option', () => {
    expect(isProvenEnough('INCOMPLETE_PROOF', { allowIncomplete: true })).toBe(true);
  });

  it('returns false for UNPROVEN', () => {
    expect(isProvenEnough('UNPROVEN')).toBe(false);
  });
});
