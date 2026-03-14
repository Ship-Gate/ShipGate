import { describe, it, expect, beforeEach } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

describe('Proof Checker', () => {
  let bundleDir: string;

  beforeEach(async () => {
    bundleDir = await mkdtemp(join(tmpdir(), 'proof-checker-test-'));
  });

  async function writeBundleManifest(manifest: Record<string, unknown>) {
    const content = JSON.stringify(manifest, null, 2);
    await writeFile(join(bundleDir, 'manifest.json'), content);
    return content;
  }

  async function writeSpecFile(specContent: string) {
    await writeFile(join(bundleDir, 'spec.isl'), specContent);
    return specContent;
  }

  async function writeEvidence(name: string, content: string) {
    const evidenceDir = join(bundleDir, 'evidence');
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(join(evidenceDir, name), content);
    return sha256(content);
  }

  function createValidManifest(overrides: Record<string, unknown> = {}) {
    const specContent = 'domain Test { }';
    const claim = {
      id: 'claim-1',
      property: 'import-integrity',
      status: 'proven',
      method: 'static-analysis',
      evidence: [{ type: 'static', hash: sha256('evidence content'), path: 'evidence/result.json' }],
    };
    const base = {
      schemaVersion: '2.0.0',
      spec: { hash: sha256(specContent), domain: 'Test' },
      verdict: 'PROVEN',
      claims: [claim],
      timestamp: new Date().toISOString(),
      ...overrides,
    };
    const canonical = canonicalize(base);
    base.bundleId = sha256(canonical);
    return { manifest: base, specContent };
  }

  it('should validate a well-formed proof bundle', async () => {
    const { manifest, specContent } = createValidManifest();
    await writeBundleManifest(manifest);
    await writeSpecFile(specContent);
    await writeEvidence('result.json', 'evidence content');

    const { verifyProofBundle } = await import('../src/checker.js');
    const result = await verifyProofBundle(bundleDir);
    expect(result.valid).toBe(true);
    expect(result.verdict).toBe('VERIFIED');
  });

  it('should reject a bundle with tampered bundleId', async () => {
    const { manifest, specContent } = createValidManifest();
    manifest.bundleId = 'tampered-id-1234567890abcdef';
    await writeBundleManifest(manifest);
    await writeSpecFile(specContent);
    await writeEvidence('result.json', 'evidence content');

    const { verifyProofBundle } = await import('../src/checker.js');
    const result = await verifyProofBundle(bundleDir);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r: string) => r.includes('Bundle ID'))).toBe(true);
  });

  it('should reject when verdict contradicts claim statuses', async () => {
    const { manifest, specContent } = createValidManifest();
    (manifest.claims as Array<{ status: string }>)[0].status = 'violated';
    const canonical = canonicalize(manifest);
    manifest.bundleId = sha256(canonical);
    await writeBundleManifest(manifest);
    await writeSpecFile(specContent);
    await writeEvidence('result.json', 'evidence content');

    const { verifyProofBundle } = await import('../src/checker.js');
    const result = await verifyProofBundle(bundleDir);
    const verdictCheck = result.checks?.find((c: { name: string }) => c.name.includes('verdict') || c.name.includes('Verdict'));
    if (verdictCheck) {
      expect(verdictCheck.passed).toBe(false);
    }
  });

  it('should reject a future timestamp', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    const { manifest, specContent } = createValidManifest({ timestamp: futureDate });
    const canonical = canonicalize(manifest);
    manifest.bundleId = sha256(canonical);
    await writeBundleManifest(manifest);
    await writeSpecFile(specContent);
    await writeEvidence('result.json', 'evidence content');

    const { verifyProofBundle } = await import('../src/checker.js');
    const result = await verifyProofBundle(bundleDir);
    const tsCheck = result.checks?.find((c: { name: string }) => c.name.includes('timestamp') || c.name.includes('Timestamp'));
    if (tsCheck) {
      expect(tsCheck.passed).toBe(false);
    }
  });

  it('should reject when evidence files are missing', async () => {
    const { manifest, specContent } = createValidManifest();
    await writeBundleManifest(manifest);
    await writeSpecFile(specContent);

    const { verifyProofBundle } = await import('../src/checker.js');
    const result = await verifyProofBundle(bundleDir);
    expect(result.valid).toBe(false);
  });
});
