import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { 
  ProofBundleGenerator,
  BundleVerifier,
  calculateTrustScore,
  generateResidualRisks,
  formatBundleAsJson,
  formatBundleAsMarkdown,
  formatBundleAsPRComment,
  createSignature,
  verifySignature,
  type PropertyProver,
  type PropertyProof,
  type ProofBundle,
  type ProjectContext,
} from '../src/proof/index.js';

describe('ProofBundleGenerator', () => {
  let testProjectPath: string;
  let bundlePath: string;

  beforeAll(() => {
    testProjectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-bundle-test-'));
    bundlePath = path.join(testProjectPath, '.isl-verify', 'proof-bundle.json');
    
    // Create a minimal test project
    fs.mkdirSync(path.join(testProjectPath, 'src'), { recursive: true });
    
    fs.writeFileSync(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
        },
      })
    );

    fs.writeFileSync(
      path.join(testProjectPath, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
        },
      })
    );

    fs.writeFileSync(
      path.join(testProjectPath, 'src', 'index.ts'),
      `export function hello() {\n  return 'world';\n}`
    );

    fs.writeFileSync(
      path.join(testProjectPath, 'src', 'auth.ts'),
      `export function authenticate(token: string) {\n  return token === 'valid';\n}`
    );
  });

  afterAll(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  it('should generate a complete proof bundle', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
      createMockProver('type-safety', 'PARTIAL', 1),
      createMockProver('auth-coverage', 'FAILED', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    const bundle = await generator.generateBundle();

    expect(bundle.version).toBe('1.0');
    expect(bundle.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(bundle.timestamp).toBeTruthy();
    expect(bundle.project.name).toBe('test-project');
    expect(bundle.project.framework).toBe('express');
    expect(bundle.project.language).toBe('typescript');
    expect(bundle.project.fileCount).toBeGreaterThan(0);
    expect(bundle.properties).toHaveLength(3);
    expect(bundle.fileHashes.length).toBeGreaterThan(0);
    expect(bundle.signature).toBeTruthy();
    expect(bundle.signature).toHaveLength(64); // SHA-256 hex
  });

  it('should handle prover failures gracefully', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
      createFailingProver(),
      createMockProver('type-safety', 'PARTIAL', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    const bundle = await generator.generateBundle();

    // Should have 2 successful proofs (failing prover is filtered out)
    expect(bundle.properties).toHaveLength(2);
    expect(bundle.metadata.proversRun).toHaveLength(3); // All 3 were run
  });

  it('should calculate correct trust score', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),    // +10
      createMockProver('type-safety', 'PROVEN', 1),         // +10
      createMockProver('error-handling', 'PARTIAL', 1),     // +5
      createMockProver('secret-exposure', 'PROVEN', 2),     // +5
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    const bundle = await generator.generateBundle();

    expect(bundle.summary.trustScore).toBe(30); // 10 + 10 + 5 + 5
    expect(bundle.summary.proven).toBe(3);
    expect(bundle.summary.partial).toBe(1);
    expect(bundle.summary.failed).toBe(0);
  });

  it('should generate residual risks for unverified properties', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
      createMockProver('type-safety', 'FAILED', 1),
      createMockProver('auth-coverage', 'PARTIAL', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    const bundle = await generator.generateBundle();

    expect(bundle.summary.residualRisks.length).toBeGreaterThan(0);
    
    // Should have FAILED risk for type-safety
    const failedRisk = bundle.summary.residualRisks.find(r => r.includes('FAILED') && r.includes('Type Safety'));
    expect(failedRisk).toBeTruthy();

    // Should have PARTIAL risk for auth-coverage
    const partialRisk = bundle.summary.residualRisks.find(r => r.includes('PARTIAL') && r.includes('Authentication'));
    expect(partialRisk).toBeTruthy();

    // Should have inherent limitations
    const limitationRisk = bundle.summary.residualRisks.find(r => r.includes('LIMITATION'));
    expect(limitationRisk).toBeTruthy();
  });

  it('should hash all source files', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    const bundle = await generator.generateBundle();

    expect(bundle.fileHashes.length).toBeGreaterThanOrEqual(2); // index.ts and auth.ts
    
    const indexHash = bundle.fileHashes.find(h => h.path.includes('index.ts'));
    expect(indexHash).toBeTruthy();
    expect(indexHash?.hash).toHaveLength(64); // SHA-256
  });

  it('should sanitize config secrets', async () => {
    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
      config: {
        apiKey: 'secret-key-123',
        publicSetting: 'visible',
        nested: {
          password: 'should-be-redacted',
          normalValue: 42,
        },
      },
    });

    const bundle = await generator.generateBundle();

    expect(bundle.metadata.config.apiKey).toBe('[REDACTED]');
    expect(bundle.metadata.config.publicSetting).toBe('visible');
    expect((bundle.metadata.config.nested as any).password).toBe('[REDACTED]');
    expect((bundle.metadata.config.nested as any).normalValue).toBe(42);
  });

  it('should run provers in parallel', async () => {
    const timestamps: number[] = [];
    
    const slowProver: PropertyProver = {
      id: 'slow-prover',
      name: 'Slow Prover',
      tier: 1,
      async prove() {
        timestamps.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100));
        return createMockProof('import-integrity', 'PROVEN', 1);
      },
    };

    const fastProver: PropertyProver = {
      id: 'fast-prover',
      name: 'Fast Prover',
      tier: 1,
      async prove() {
        timestamps.push(Date.now());
        return createMockProof('type-safety', 'PROVEN', 1);
      },
    };

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: [slowProver, fastProver],
    });

    await generator.generateBundle();

    // Both should start roughly at the same time (parallel execution)
    expect(timestamps).toHaveLength(2);
    expect(Math.abs(timestamps[0] - timestamps[1])).toBeLessThan(50);
  });
});

describe('BundleVerifier', () => {
  let testProjectPath: string;
  let bundlePath: string;
  let originalBundle: ProofBundle;

  beforeAll(async () => {
    testProjectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-verify-test-'));
    bundlePath = path.join(testProjectPath, 'proof-bundle.json');

    fs.mkdirSync(path.join(testProjectPath, 'src'), { recursive: true });
    
    fs.writeFileSync(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({ name: 'verify-test' })
    );

    fs.writeFileSync(
      path.join(testProjectPath, 'src', 'index.ts'),
      `export const test = 1;`
    );

    const mockProvers: PropertyProver[] = [
      createMockProver('import-integrity', 'PROVEN', 1),
    ];

    const generator = new ProofBundleGenerator({
      projectPath: testProjectPath,
      provers: mockProvers,
    });

    originalBundle = await generator.generateBundle();
    fs.writeFileSync(bundlePath, JSON.stringify(originalBundle, null, 2));
  });

  afterAll(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  it('should verify an intact bundle', async () => {
    const verifier = new BundleVerifier(bundlePath);
    const result = await verifier.verify();

    expect(result.valid).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.filesIntact).toBe(true);
    expect(result.modifiedFiles).toHaveLength(0);
    expect(result.missingFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect modified files', async () => {
    // Modify a source file
    const srcPath = path.join(testProjectPath, 'src', 'index.ts');
    fs.writeFileSync(srcPath, `export const test = 2; // modified`);

    const verifier = new BundleVerifier(bundlePath);
    const result = await verifier.verify();

    expect(result.valid).toBe(false);
    expect(result.filesIntact).toBe(false);
    expect(result.modifiedFiles.length).toBeGreaterThan(0);
    expect(result.modifiedFiles).toContain('src/index.ts');
    expect(result.errors.some(e => e.includes('modified'))).toBe(true);

    // Restore original
    fs.writeFileSync(srcPath, `export const test = 1;`);
  });

  it('should detect missing files', async () => {
    const srcPath = path.join(testProjectPath, 'src', 'index.ts');
    const backup = fs.readFileSync(srcPath, 'utf-8');
    
    // Delete file
    fs.unlinkSync(srcPath);

    const verifier = new BundleVerifier(bundlePath);
    const result = await verifier.verify();

    expect(result.valid).toBe(false);
    expect(result.filesIntact).toBe(false);
    expect(result.missingFiles).toContain('src/index.ts');
    expect(result.errors.some(e => e.includes('missing'))).toBe(true);

    // Restore file
    fs.writeFileSync(srcPath, backup);
  });

  it('should detect tampered bundle', async () => {
    const tamperedBundle = JSON.parse(JSON.stringify(originalBundle));
    tamperedBundle.summary.trustScore = 100; // Tamper with score
    
    const tamperedPath = path.join(testProjectPath, 'tampered-bundle.json');
    fs.writeFileSync(tamperedPath, JSON.stringify(tamperedBundle, null, 2));

    const verifier = new BundleVerifier(tamperedPath);
    const result = await verifier.verify();

    expect(result.valid).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.errors.some(e => e.includes('Signature'))).toBe(true);

    fs.unlinkSync(tamperedPath);
  });

  it('should throw on non-existent bundle', () => {
    expect(() => new BundleVerifier('/nonexistent/bundle.json')).toThrow('Bundle file not found');
  });

  it('should throw on invalid JSON', () => {
    const invalidPath = path.join(testProjectPath, 'invalid.json');
    fs.writeFileSync(invalidPath, 'not valid json{');

    expect(() => new BundleVerifier(invalidPath)).toThrow('Invalid bundle file');

    fs.unlinkSync(invalidPath);
  });
});

describe('Trust Score Calculation', () => {
  it('should calculate score for tier 1 properties', () => {
    const properties: PropertyProof[] = [
      createMockProof('import-integrity', 'PROVEN', 1),   // +10
      createMockProof('type-safety', 'PROVEN', 1),        // +10
      createMockProof('error-handling', 'PARTIAL', 1),    // +5
    ];

    const score = calculateTrustScore(properties);
    expect(score).toBe(25);
  });

  it('should calculate score for tier 2 properties', () => {
    const properties: PropertyProof[] = [
      createMockProof('secret-exposure', 'PROVEN', 2),       // +5
      createMockProof('dependency-security', 'PARTIAL', 2),  // +2
    ];

    const score = calculateTrustScore(properties);
    expect(score).toBe(7);
  });

  it('should give zero points for failed properties', () => {
    const properties: PropertyProof[] = [
      createMockProof('import-integrity', 'FAILED', 1),
      createMockProof('type-safety', 'NOT_VERIFIED', 1),
    ];

    const score = calculateTrustScore(properties);
    expect(score).toBe(0);
  });

  it('should cap score at 100', () => {
    const properties: PropertyProof[] = Array(20).fill(null).map(() => 
      createMockProof('import-integrity', 'PROVEN', 1)
    );

    const score = calculateTrustScore(properties);
    expect(score).toBe(100);
  });
});

describe('Formatters', () => {
  let sampleBundle: ProofBundle;

  beforeAll(() => {
    sampleBundle = {
      version: '1.0',
      id: '12345678-1234-4234-8234-123456789012',
      timestamp: '2026-02-17T12:00:00.000Z',
      project: {
        name: 'test-project',
        path: '/test/path',
        commit: 'abc123def456',
        branch: 'main',
        framework: 'express',
        language: 'typescript',
        fileCount: 10,
        loc: 1000,
      },
      fileHashes: [],
      properties: [
        createMockProof('import-integrity', 'PROVEN', 1),
        createMockProof('type-safety', 'FAILED', 1),
      ],
      summary: {
        proven: 1,
        partial: 0,
        failed: 1,
        notVerified: 0,
        overallVerdict: 'PARTIAL',
        trustScore: 50,
        residualRisks: ['FAILED — Type Safety: Type errors may exist'],
      },
      metadata: {
        toolVersion: '1.0.0',
        proversRun: ['import-integrity', 'type-safety'],
        duration_ms: 1000,
        config: {},
      },
      signature: 'a'.repeat(64),
    };
  });

  it('should format as JSON', () => {
    const json = formatBundleAsJson(sampleBundle);
    const parsed = JSON.parse(json);
    
    expect(parsed.version).toBe('1.0');
    expect(parsed.id).toBe(sampleBundle.id);
    expect(parsed.summary.trustScore).toBe(50);
  });

  it('should format as Markdown', () => {
    const markdown = formatBundleAsMarkdown(sampleBundle);
    
    expect(markdown).toContain('# ISL Verification Proof Bundle');
    expect(markdown).toContain('**Score:** 50/100');
    expect(markdown).toContain('**Verdict:** PARTIAL');
    expect(markdown).toContain('import-integrity');
    expect(markdown).toContain('✅ PROVEN');
    expect(markdown).toContain('❌ FAILED');
  });

  it('should format as PR comment', () => {
    const comment = formatBundleAsPRComment(sampleBundle);
    
    expect(comment).toContain('## ⚠️ ISL Verification Results');
    expect(comment).toContain('**Trust Score:** 50/100');
    expect(comment).toContain('| ✅ Proven | ⚠️ Partial | ❌ Failed |');
    expect(comment).toContain('### ❌ Failed Properties');
  });
});

describe('Cryptographic Signing', () => {
  it('should create deterministic signatures', async () => {
    const bundle = {
      version: '1.0' as const,
      id: 'test-id',
      timestamp: '2026-02-17T12:00:00.000Z',
      project: { name: 'test', path: '/test', commit: null, branch: null, framework: 'unknown', language: 'typescript' as const, fileCount: 0, loc: 0 },
      fileHashes: [],
      properties: [],
      summary: { proven: 0, partial: 0, failed: 0, notVerified: 0, overallVerdict: 'INSUFFICIENT' as const, trustScore: 0, residualRisks: [] },
      metadata: { toolVersion: '1.0.0', proversRun: [], duration_ms: 0, config: {} },
    };

    const sig1 = await createSignature(bundle, { projectPath: '/test', secret: 'test-secret' });
    const sig2 = await createSignature(bundle, { projectPath: '/test', secret: 'test-secret' });

    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it('should create different signatures for different secrets', async () => {
    const bundle = {
      version: '1.0' as const,
      id: 'test-id',
      timestamp: '2026-02-17T12:00:00.000Z',
      project: { name: 'test', path: '/test', commit: null, branch: null, framework: 'unknown', language: 'typescript' as const, fileCount: 0, loc: 0 },
      fileHashes: [],
      properties: [],
      summary: { proven: 0, partial: 0, failed: 0, notVerified: 0, overallVerdict: 'INSUFFICIENT' as const, trustScore: 0, residualRisks: [] },
      metadata: { toolVersion: '1.0.0', proversRun: [], duration_ms: 0, config: {} },
    };

    const sig1 = await createSignature(bundle, { projectPath: '/test', secret: 'secret1' });
    const sig2 = await createSignature(bundle, { projectPath: '/test', secret: 'secret2' });

    expect(sig1).not.toBe(sig2);
  });

  it('should verify correct signatures', async () => {
    const bundle = {
      version: '1.0' as const,
      id: 'test-id',
      timestamp: '2026-02-17T12:00:00.000Z',
      project: { name: 'test', path: '/test', commit: null, branch: null, framework: 'unknown', language: 'typescript' as const, fileCount: 0, loc: 0 },
      fileHashes: [],
      properties: [],
      summary: { proven: 0, partial: 0, failed: 0, notVerified: 0, overallVerdict: 'INSUFFICIENT' as const, trustScore: 0, residualRisks: [] },
      metadata: { toolVersion: '1.0.0', proversRun: [], duration_ms: 0, config: {} },
    };

    const signature = await createSignature(bundle, { projectPath: '/test', secret: 'test-secret' });
    const fullBundle = { ...bundle, signature };

    const isValid = await verifySignature(fullBundle, { projectPath: '/test', secret: 'test-secret' });
    expect(isValid).toBe(true);
  });

  it('should reject tampered signatures', async () => {
    const bundle = {
      version: '1.0' as const,
      id: 'test-id',
      timestamp: '2026-02-17T12:00:00.000Z',
      project: { name: 'test', path: '/test', commit: null, branch: null, framework: 'unknown', language: 'typescript' as const, fileCount: 0, loc: 0 },
      fileHashes: [],
      properties: [],
      summary: { proven: 0, partial: 0, failed: 0, notVerified: 0, overallVerdict: 'INSUFFICIENT' as const, trustScore: 0, residualRisks: [] },
      metadata: { toolVersion: '1.0.0', proversRun: [], duration_ms: 0, config: {} },
    };

    const signature = await createSignature(bundle, { projectPath: '/test', secret: 'test-secret' });
    const tamperedBundle = { ...bundle, summary: { ...bundle.summary, trustScore: 100 }, signature };

    const isValid = await verifySignature(tamperedBundle, { projectPath: '/test', secret: 'test-secret' });
    expect(isValid).toBe(false);
  });
});

// Helper functions
function createMockProver(property: string, status: 'PROVEN' | 'PARTIAL' | 'FAILED' | 'NOT_VERIFIED', tier: 1 | 2): PropertyProver {
  return {
    id: `${property}-prover`,
    name: property,
    tier,
    async prove(_context: ProjectContext): Promise<PropertyProof> {
      return createMockProof(property as any, status, tier);
    },
  };
}

function createFailingProver(): PropertyProver {
  return {
    id: 'failing-prover',
    name: 'Failing Prover',
    tier: 1,
    async prove(): Promise<PropertyProof> {
      throw new Error('Prover failed intentionally');
    },
  };
}

function createMockProof(property: string, status: 'PROVEN' | 'PARTIAL' | 'FAILED' | 'NOT_VERIFIED', tier: 1 | 2): PropertyProof {
  return {
    property: property as any,
    status,
    summary: `Mock ${status} proof for ${property}`,
    evidence: [],
    findings: status === 'FAILED' ? [{ file: 'test.ts', line: 1, severity: 'error', message: 'Mock error' }] : [],
    method: 'static-ast-analysis',
    confidence: status === 'PROVEN' ? 'definitive' : 'high',
    duration_ms: 100,
  };
}
