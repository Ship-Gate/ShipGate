import { describe, it, expect, beforeEach } from 'vitest';
import { SecretExposureProver } from '../src/proof/secret-exposure-prover.js';
import type { ProjectContext } from '../src/proof/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SecretExposureProver', () => {
  let prover: SecretExposureProver;
  const testDir = path.join(__dirname, '.test-temp', 'secret-exposure');

  beforeEach(async () => {
    prover = new SecretExposureProver();
    
    // Clean and create test directory
    await fs.promises.rm(testDir, { recursive: true, force: true });
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  describe('Pattern Matching', () => {
    it('should detect Stripe live keys', async () => {
      const file = path.join(testDir, 'stripe.ts');
      await fs.promises.writeFile(file, `
        const apiKey = "sk_live_51H8xYZ123456789012345";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings).toHaveLength(1);
      expect(proof.findings[0]?.message).toContain('stripe_live_key');
      expect(proof.findings[0]?.severity).toBe('error');
    });

    it('should detect GitHub tokens', async () => {
      const file = path.join(testDir, 'github.ts');
      await fs.promises.writeFile(file, `
        const token = "ghp_1234567890123456789012345678901234";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('github_token'))).toBe(true);
    });

    it('should detect AWS access keys', async () => {
      const file = path.join(testDir, 'aws.ts');
      await fs.promises.writeFile(file, `
        const accessKey = "AKIAIOSFODNN7EXAMPLE";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('aws_access_key'))).toBe(true);
    });

    it('should detect private keys', async () => {
      const file = path.join(testDir, 'keys.ts');
      await fs.promises.writeFile(file, `
        const privateKey = "-----BEGIN PRIVATE KEY-----";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('private_key'))).toBe(true);
    });
  });

  describe('Sensitive Variable Detection', () => {
    it('should detect password assignments', async () => {
      const file = path.join(testDir, 'password.ts');
      await fs.promises.writeFile(file, `
        const password = "mySecretPassword123";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('password'))).toBe(true);
    });

    it('should detect apiKey assignments', async () => {
      const file = path.join(testDir, 'apikey.ts');
      await fs.promises.writeFile(file, `
        const apiKey = "abcdef123456789";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('apiKey'))).toBe(true);
    });
  });

  describe('Entropy Analysis', () => {
    it('should detect high-entropy strings', async () => {
      const file = path.join(testDir, 'entropy.ts');
      await fs.promises.writeFile(file, `
        const secret = "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('High-entropy'))).toBe(true);
    });

    it('should not flag regular text', async () => {
      const file = path.join(testDir, 'text.ts');
      await fs.promises.writeFile(file, `
        const message = "Hello world this is a test message";
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.filter(f => f.message.includes('High-entropy'))).toHaveLength(0);
    });
  });

  describe('Gitignore Checks', () => {
    it('should verify .env is gitignored', async () => {
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.promises.writeFile(gitignorePath, 'node_modules\n.env\n');

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [],
        gitignorePath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.filter(f => f.message.includes('.env files not gitignored'))).toHaveLength(0);
    });

    it('should warn if .env not gitignored', async () => {
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.promises.writeFile(gitignorePath, 'node_modules\n');

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [],
        gitignorePath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('.env files not gitignored'))).toBe(true);
    });
  });

  describe('Clean Project', () => {
    it('should return PROVEN for clean project', async () => {
      const file = path.join(testDir, 'clean.ts');
      await fs.promises.writeFile(file, `
        import { config } from 'dotenv';
        config();
        
        const apiKey = process.env.API_KEY;
        const dbUrl = process.env.DATABASE_URL;
      `);

      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.promises.writeFile(gitignorePath, '.env\nnode_modules\n');

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        gitignorePath,
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
      expect(proof.findings.filter(f => f.severity === 'error')).toHaveLength(0);
    });
  });

  describe('Proof Metadata', () => {
    it('should have correct tier and ID', () => {
      expect(prover.tier).toBe(1);
      expect(prover.id).toBe('tier1-secret-exposure');
      expect(prover.name).toBe('Secret Exposure Prevention');
    });

    it('should include duration in proof', async () => {
      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [],
      };

      const proof = await prover.prove(context);

      expect(proof.duration_ms).toBeGreaterThan(0);
      expect(proof.method).toBe('pattern-matching');
      expect(proof.confidence).toBe('high');
    });
  });
});
