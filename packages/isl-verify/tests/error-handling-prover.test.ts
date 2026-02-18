import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandlingProver } from '../src/proof/error-handling-prover.js';
import type { ProjectContext } from '../src/proof/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ErrorHandlingProver', () => {
  let prover: ErrorHandlingProver;
  const testDir = path.join(__dirname, '.test-temp', 'error-handling');

  beforeEach(async () => {
    prover = new ErrorHandlingProver();
    
    await fs.promises.rm(testDir, { recursive: true, force: true });
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  describe('Route Handler Detection', () => {
    it('should detect Express route handlers without try-catch', async () => {
      const file = path.join(testDir, 'express.ts');
      await fs.promises.writeFile(file, `
        app.get('/users/:id', async (req, res) => {
          const user = await db.user.findUnique({ where: { id: req.params.id } });
          res.json(user);
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('missing try-catch'))).toBe(true);
    });

    it('should accept route handlers with try-catch', async () => {
      const file = path.join(testDir, 'express-safe.ts');
      await fs.promises.writeFile(file, `
        app.get('/users/:id', async (req, res) => {
          try {
            const user = await db.user.findUnique({ where: { id: req.params.id } });
            res.json(user);
          } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
          }
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
    });

    it('should detect Fastify route handlers', async () => {
      const file = path.join(testDir, 'fastify.ts');
      await fs.promises.writeFile(file, `
        fastify.get('/users/:id', async (request, reply) => {
          const user = await db.user.findUnique({ where: { id: request.params.id } });
          return user;
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.severity === 'error')).toBe(true);
    });
  });

  describe('Try-Catch Analysis', () => {
    it('should detect empty catch blocks', async () => {
      const file = path.join(testDir, 'empty-catch.ts');
      await fs.promises.writeFile(file, `
        try {
          await doSomething();
        } catch (e) {
          // empty
        }
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('Empty or ineffective'))).toBe(true);
    });

    it('should detect console.log-only catch blocks', async () => {
      const file = path.join(testDir, 'console-catch.ts');
      await fs.promises.writeFile(file, `
        try {
          await doSomething();
        } catch (e) {
          console.log(e);
        }
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('Empty or ineffective'))).toBe(true);
    });

    it('should accept meaningful catch blocks', async () => {
      const file = path.join(testDir, 'good-catch.ts');
      await fs.promises.writeFile(file, `
        app.get('/test', async (req, res) => {
          try {
            await doSomething();
          } catch (error) {
            logger.error('Operation failed', { error });
            res.status(500).json({ error: 'Operation failed' });
          }
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      const emptyBlockFindings = proof.findings.filter(f => f.message.includes('Empty or ineffective'));
      expect(emptyBlockFindings).toHaveLength(0);
    });
  });

  describe('Stack Trace Leak Detection', () => {
    it('should detect error.stack in response', async () => {
      const file = path.join(testDir, 'stack-leak.ts');
      await fs.promises.writeFile(file, `
        app.get('/test', async (req, res) => {
          try {
            await doSomething();
          } catch (error) {
            res.status(500).json({ error: error.stack });
          }
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('Stack trace leaked'))).toBe(true);
    });

    it('should not flag error.stack in logging', async () => {
      const file = path.join(testDir, 'stack-log.ts');
      await fs.promises.writeFile(file, `
        try {
          await doSomething();
        } catch (error) {
          logger.error(error.stack);
          res.status(500).json({ error: 'Internal error' });
        }
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      const stackLeakFindings = proof.findings.filter(f => f.message.includes('Stack trace leaked'));
      expect(stackLeakFindings).toHaveLength(0);
    });
  });

  describe('Promise Chain Analysis', () => {
    it('should detect promise chains without .catch()', async () => {
      const file = path.join(testDir, 'no-catch.ts');
      await fs.promises.writeFile(file, `
        fetch('/api/data')
          .then(res => res.json())
          .then(data => console.log(data));
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('without .catch()'))).toBe(true);
    });

    it('should accept promise chains with .catch()', async () => {
      const file = path.join(testDir, 'with-catch.ts');
      await fs.promises.writeFile(file, `
        fetch('/api/data')
          .then(res => res.json())
          .then(data => console.log(data))
          .catch(err => console.error(err));
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      const noCatchFindings = proof.findings.filter(f => f.message.includes('without .catch()'));
      expect(noCatchFindings).toHaveLength(0);
    });
  });

  describe('Async/Await Error Handling', () => {
    it('should detect await without try-catch', async () => {
      const file = path.join(testDir, 'no-try.ts');
      await fs.promises.writeFile(file, `
        async function getData() {
          const data = await fetch('/api/data');
          return data.json();
        }
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('Await expression without try-catch'))).toBe(true);
    });
  });

  describe('HTTP Status Codes', () => {
    it('should detect error responses with status 200', async () => {
      const file = path.join(testDir, 'wrong-status.ts');
      await fs.promises.writeFile(file, `
        app.get('/test', async (req, res) => {
          try {
            await doSomething();
          } catch (error) {
            res.status(200).json({ error: 'Failed' });
          }
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('Error response using HTTP 200'))).toBe(true);
    });
  });

  describe('Floating Promises', () => {
    it('should detect floating promises', async () => {
      const file = path.join(testDir, 'floating.ts');
      await fs.promises.writeFile(file, `
        doAsyncWork().then(result => console.log(result));
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('Floating promise'))).toBe(true);
    });
  });

  describe('Proof Metadata', () => {
    it('should have correct tier and ID', () => {
      expect(prover.tier).toBe(1);
      expect(prover.id).toBe('tier1-error-handling');
      expect(prover.name).toBe('Error Handling Completeness');
    });

    it('should collect evidence for handlers', async () => {
      const file = path.join(testDir, 'test.ts');
      await fs.promises.writeFile(file, `
        app.get('/test', async (req, res) => {
          try {
            const data = await getData();
            res.json(data);
          } catch (error) {
            logger.error(error);
            res.status(500).json({ error: 'Failed' });
          }
        });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.evidence.length).toBeGreaterThan(0);
      expect(proof.evidence.some(e => 'type' in e && e.type === 'try-catch')).toBe(true);
    });
  });
});
