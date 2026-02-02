/**
 * ISL Evidence - Bundle Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  writeEvidenceBundle,
  readEvidenceBundle,
  validateEvidenceBundle,
  verifyEvidenceBundle,
  computeHash,
  deterministicSerialize,
  createFingerprint,
} from '../src/index.js';
import type { GateResult, Finding } from '@isl-lang/gate';

describe('ISL Evidence - Bundle Writer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isl-evidence-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should write evidence bundle with manifest and results', async () => {
    const result: GateResult = {
      verdict: 'NO_SHIP',
      score: 65,
      reasons: [
        {
          code: 'GHOST_ROUTE',
          message: '2 ghost routes detected',
          files: ['src/api.ts'],
          severity: 'high',
        },
      ],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'abc123def456',
      durationMs: 150,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const findings: Finding[] = [
      {
        id: '1',
        type: 'ghost_route',
        severity: 'high',
        message: 'API endpoint /api/users not found',
        file: 'src/api.ts',
        line: 10,
      },
      {
        id: '2',
        type: 'ghost_route',
        severity: 'high',
        message: 'API endpoint /api/admin not found',
        file: 'src/api.ts',
        line: 20,
      },
    ];

    const evidenceDir = await writeEvidenceBundle(result, findings, {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test/project',
      projectName: 'test-project',
      deterministic: true,
    });

    // Check that files were created
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    const resultsPath = path.join(evidenceDir, 'results.json');
    const reportPath = path.join(evidenceDir, 'report.html');

    expect(await fileExists(manifestPath)).toBe(true);
    expect(await fileExists(resultsPath)).toBe(true);
    expect(await fileExists(reportPath)).toBe(true);

    // Validate manifest
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.fingerprint).toBe('abc123def456');
    expect(manifest.project.name).toBe('test-project');

    // Validate results
    const resultsContent = await fs.readFile(resultsPath, 'utf-8');
    const results = JSON.parse(resultsContent);
    expect(results.verdict).toBe('NO_SHIP');
    expect(results.score).toBe(65);
    expect(results.findings.length).toBe(2);
    expect(results.summary.high).toBe(2);
  });

  it('should read evidence bundle back', async () => {
    const result: GateResult = {
      verdict: 'SHIP',
      score: 100,
      reasons: [{ code: 'PASS', message: 'All checks passed', files: [] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'abc123',
      durationMs: 50,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    const bundle = await readEvidenceBundle(evidenceDir);

    expect(bundle).not.toBeNull();
    expect(bundle!.manifest.fingerprint).toBe('abc123');
    expect(bundle!.results.verdict).toBe('SHIP');
    expect(bundle!.results.score).toBe(100);
    expect(bundle!.reportHtml).toContain('SHIP');
  });

  it('should validate evidence bundle structure', async () => {
    const result: GateResult = {
      verdict: 'NO_SHIP',
      score: 50,
      reasons: [{ code: 'TEST', message: 'Test', files: [] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'test123',
      durationMs: 100,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    const validation = await validateEvidenceBundle(evidenceDir);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('should fail validation for missing manifest', async () => {
    await fs.mkdir(path.join(tempDir, 'bad-evidence'), { recursive: true });
    
    const validation = await validateEvidenceBundle(path.join(tempDir, 'bad-evidence'));
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Missing manifest.json');
  });

  it('should generate HTML report with findings', async () => {
    const result: GateResult = {
      verdict: 'NO_SHIP',
      score: 45,
      reasons: [
        { code: 'CRITICAL', message: 'Critical issue found', files: ['app.ts'] },
      ],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'report-test',
      durationMs: 200,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const findings: Finding[] = [
      {
        id: '1',
        type: 'security',
        severity: 'critical',
        message: 'Hardcoded credential found',
        file: 'config.ts',
        line: 5,
      },
    ];

    const evidenceDir = await writeEvidenceBundle(result, findings, {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      includeHtmlReport: true,
      deterministic: true,
    });

    const reportPath = path.join(evidenceDir, 'report.html');
    const html = await fs.readFile(reportPath, 'utf-8');

    // Check HTML contains expected elements
    expect(html).toContain('NO_SHIP');
    expect(html).toContain('45/100');
    expect(html).toContain('security');
    expect(html).toContain('Hardcoded credential found');
    expect(html).toContain('config.ts');
    expect(html).toContain('CRITICAL');
  });
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('ISL Evidence - Signing & Verification', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isl-signing-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should compute consistent SHA-256 hashes', () => {
    const content = 'test content for hashing';
    const hash1 = computeHash(content);
    const hash2 = computeHash(content);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('should produce different hashes for different content', () => {
    const hash1 = computeHash('content A');
    const hash2 = computeHash('content B');

    expect(hash1).not.toBe(hash2);
  });

  it('should serialize objects deterministically with sorted keys', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, z: 1, m: 3 };

    const serialized1 = deterministicSerialize(obj1);
    const serialized2 = deterministicSerialize(obj2);

    expect(serialized1).toBe(serialized2);
    
    // First key should be 'a' in output
    const parsed = JSON.parse(serialized1);
    const keys = Object.keys(parsed);
    expect(keys[0]).toBe('a');
  });

  it('should create deterministic fingerprints', () => {
    const content = JSON.stringify({ verdict: 'SHIP', score: 100 });
    const fp1 = createFingerprint(content);
    const fp2 = createFingerprint(content);

    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(16); // First 16 chars of hash
  });

  it('should write signed evidence bundle', async () => {
    const result: GateResult = {
      verdict: 'SHIP',
      score: 100,
      reasons: [{ code: 'PASS', message: 'All passed', files: [] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'signed-test',
      durationMs: 50,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    // Check signature file exists
    const signaturePath = path.join(evidenceDir, 'signature.json');
    expect(await fileExists(signaturePath)).toBe(true);

    // Read and validate signature structure
    const signatureContent = await fs.readFile(signaturePath, 'utf-8');
    const signature = JSON.parse(signatureContent);

    expect(signature.algorithm).toBe('sha256');
    expect(signature.version).toBe('1.0');
    expect(signature.manifestHash).toBeTruthy();
    expect(signature.resultsHash).toBeTruthy();
    expect(signature.integrityHash).toBeTruthy();
  });

  it('should verify untampered evidence bundle', async () => {
    const result: GateResult = {
      verdict: 'NO_SHIP',
      score: 65,
      reasons: [{ code: 'ISSUE', message: 'Found issue', files: ['src/app.ts'] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'verify-test',
      durationMs: 100,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    const verification = await verifyEvidenceBundle(evidenceDir);

    expect(verification.valid).toBe(true);
    expect(verification.errors.length).toBe(0);
    expect(verification.signature).toBeDefined();
  });

  it('should detect tampered manifest', async () => {
    const result: GateResult = {
      verdict: 'SHIP',
      score: 100,
      reasons: [{ code: 'PASS', message: 'All passed', files: [] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'tamper-test',
      durationMs: 50,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    // Tamper with manifest
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    const originalManifest = await fs.readFile(manifestPath, 'utf-8');
    const tamperedManifest = originalManifest.replace('tamper-test', 'FAKE-fingerprint');
    await fs.writeFile(manifestPath, tamperedManifest);

    // Verification should fail
    const verification = await verifyEvidenceBundle(evidenceDir);

    expect(verification.valid).toBe(false);
    expect(verification.errors.length).toBeGreaterThan(0);
    expect(verification.errors.some(e => e.includes('mismatch'))).toBe(true);
  });

  it('should detect tampered results', async () => {
    const result: GateResult = {
      verdict: 'NO_SHIP',
      score: 30,
      reasons: [{ code: 'CRITICAL', message: 'Critical issue', files: [] }],
      evidencePath: path.join(tempDir, 'evidence'),
      fingerprint: 'results-tamper',
      durationMs: 50,
      timestamp: '1970-01-01T00:00:00.000Z',
    };

    const evidenceDir = await writeEvidenceBundle(result, [], {
      outputDir: path.join(tempDir, 'evidence'),
      projectRoot: '/test',
      deterministic: true,
    });

    // Tamper with results - change verdict from NO_SHIP to SHIP
    const resultsPath = path.join(evidenceDir, 'results.json');
    const originalResults = await fs.readFile(resultsPath, 'utf-8');
    const tamperedResults = originalResults.replace('NO_SHIP', 'SHIP');
    await fs.writeFile(resultsPath, tamperedResults);

    // Verification should fail
    const verification = await verifyEvidenceBundle(evidenceDir);

    expect(verification.valid).toBe(false);
    expect(verification.errors.some(e => e.includes('Results hash mismatch'))).toBe(true);
  });
});
