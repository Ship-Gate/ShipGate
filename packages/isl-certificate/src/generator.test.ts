import { describe, it, expect, beforeEach } from 'vitest';
import { generateCertificate, generateAndSaveCertificate, CERTIFICATE_FILENAME } from './generator.js';
import { verifyCertificate } from './verifier.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('ISL Certificate Generator', () => {
  const projectRoot = join(tmpdir(), `isl-cert-test-${randomUUID()}`);

  const sampleInput = {
    prompt: 'Build a todo app with auth',
    islSpec: {
      content: 'domain TodoApp { entity Task { id: string; title: string } }',
      version: '1.0',
      constructCount: 2,
    },
    generatedFiles: [
      { path: 'src/task.ts', content: 'export const Task = {};', tier: 1 as const, specCoverage: 0.9 },
      { path: 'src/index.ts', content: 'export {};', tier: 2 as const, specCoverage: 0.8 },
    ],
    verification: {
      verdict: 'SHIP' as const,
      trustScore: 95,
      evidenceCount: 10,
      testsRun: 5,
      testsPassed: 5,
      securityChecks: [{ check: 'no-secrets', passed: true }],
    },
    model: { provider: 'anthropic', model: 'claude-3', tokensUsed: 1500 },
    pipeline: {
      duration: 5000,
      stages: [
        { name: 'parse', duration: 100, status: 'success' },
        { name: 'verify', duration: 2000, status: 'success' },
      ],
    },
  };

  beforeEach(async () => {
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(join(projectRoot, 'src'), { recursive: true });
    await writeFile(join(projectRoot, 'src/task.ts'), 'export const Task = {};', 'utf-8');
    await writeFile(join(projectRoot, 'src/index.ts'), 'export {};', 'utf-8');
  });

  it('generates certificate with correct structure', async () => {
    const cert = await generateCertificate(sampleInput, {
      projectRoot,
      apiKey: 'test-key',
    });

    expect(cert.version).toBe('1.0');
    expect(cert.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(cert.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(cert.prompt.hash).toHaveLength(64);
    expect(cert.prompt.preview).toContain('Build a todo app');
    expect(cert.islSpec.hash).toHaveLength(64);
    expect(cert.generatedFiles).toHaveLength(2);
    expect(cert.verification.verdict).toBe('SHIP');
    expect(cert.verification.trustScore).toBe(95);
    expect(cert.signature).toHaveLength(64);
  });

  it('produces deterministic hashes for same content', async () => {
    const cert1 = await generateCertificate(sampleInput, { projectRoot, apiKey: 'k1' });
    const cert2 = await generateCertificate(sampleInput, { projectRoot, apiKey: 'k1' });

    expect(cert1.prompt.hash).toBe(cert2.prompt.hash);
    expect(cert1.islSpec.hash).toBe(cert2.islSpec.hash);
    expect(cert1.generatedFiles[0]!.hash).toBe(cert2.generatedFiles[0]!.hash);
  });

  it('signature differs with different API keys', async () => {
    const cert1 = await generateCertificate(sampleInput, { projectRoot, apiKey: 'key-a' });
    const cert2 = await generateCertificate(sampleInput, { projectRoot, apiKey: 'key-b' });

    expect(cert1.signature).not.toBe(cert2.signature);
  });

  it('generateAndSaveCertificate writes to disk', async () => {
    const outputPath = join(projectRoot, CERTIFICATE_FILENAME);
    const { certificate, path } = await generateAndSaveCertificate(sampleInput, {
      projectRoot,
      apiKey: 'test',
      outputPath,
    });

    expect(path).toBe(outputPath);
    const raw = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe(certificate.id);
    expect(parsed.signature).toBe(certificate.signature);
  });

  it('verifier accepts valid certificate', async () => {
    const cert = await generateCertificate(sampleInput, { projectRoot, apiKey: 'verify-key' });
    const result = await verifyCertificate(cert, projectRoot, 'verify-key');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.details!.signatureValid).toBe(true);
    expect(result.details!.filesVerified).toBe(2);
  });

  it('verifier rejects tampered certificate', async () => {
    const cert = await generateCertificate(sampleInput, { projectRoot, apiKey: 'key' });
    cert.verification.trustScore = 999; // Tamper
    const result = await verifyCertificate(cert, projectRoot, 'key');

    expect(result.valid).toBe(false);
    expect(result.details!.signatureValid).toBe(false);
  });

  it('verifier detects file hash mismatch', async () => {
    const cert = await generateCertificate(sampleInput, { projectRoot, apiKey: 'key' });
    const { writeFile } = await import('fs/promises');
    await writeFile(join(projectRoot, 'src/task.ts'), '// tampered content', 'utf-8');
    const result = await verifyCertificate(cert, projectRoot, 'key');

    expect(result.valid).toBe(false);
    expect(result.details!.filesMismatched).toContain('src/task.ts');
  });
});
