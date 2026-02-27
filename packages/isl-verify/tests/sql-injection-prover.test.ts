import { describe, it, expect, beforeEach } from 'vitest';
import { SQLInjectionProver } from '../src/proof/sql-injection-prover.js';
import type { ProjectContext } from '../src/proof/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SQLInjectionProver', () => {
  let prover: SQLInjectionProver;
  const testDir = path.join(__dirname, '.test-temp', 'sql-injection');

  beforeEach(async () => {
    prover = new SQLInjectionProver();
    
    await fs.promises.rm(testDir, { recursive: true, force: true });
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  describe('ORM Detection', () => {
    it('should detect Prisma from package.json', async () => {
      const file = path.join(testDir, 'db.ts');
      await fs.promises.writeFile(file, `
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        packageJson: {
          dependencies: {
            '@prisma/client': '^5.0.0',
          },
        },
      };

      const proof = await prover.prove(context);

      expect(proof.summary).toContain('prisma');
    });

    it('should detect multiple ORMs', async () => {
      const file = path.join(testDir, 'db.ts');
      await fs.promises.writeFile(file, `
        import { PrismaClient } from '@prisma/client';
        import pg from 'pg';
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        packageJson: {
          dependencies: {
            '@prisma/client': '^5.0.0',
            'pg': '^8.0.0',
          },
        },
      };

      const proof = await prover.prove(context);

      expect(proof.summary).toContain('prisma');
      expect(proof.summary).toContain('pg');
    });
  });

  describe('Unsafe Patterns', () => {
    it('should detect Prisma $queryRaw with template literal', async () => {
      const file = path.join(testDir, 'unsafe-prisma.ts');
      await fs.promises.writeFile(file, `
        const userId = req.params.id;
        const result = await prisma.$queryRaw\`SELECT * FROM users WHERE id = \${userId}\`;
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('$queryRaw'))).toBe(true);
    });

    it('should detect string concatenation in SQL', async () => {
      const file = path.join(testDir, 'concat.ts');
      await fs.promises.writeFile(file, `
        const table = req.query.table;
        const query = "SELECT * FROM " + table;
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('String concatenation'))).toBe(true);
    });

    it('should detect template literals in WHERE clause', async () => {
      const file = path.join(testDir, 'template.ts');
      await fs.promises.writeFile(file, `
        const userId = req.params.id;
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('WHERE'))).toBe(true);
    });

    it('should detect MongoDB $where injection', async () => {
      const file = path.join(testDir, 'mongo-where.ts');
      await fs.promises.writeFile(file, `
        const userInput = req.query.search;
        const filter = { $where: userInput };
        const result = await collection.find(filter);
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('$where'))).toBe(true);
    });

    it('should detect MongoDB $regex with template literal', async () => {
      const file = path.join(testDir, 'mongo-regex.ts');
      await fs.promises.writeFile(file, `
        const userInput = req.query.search;
        const filter = { name: { $regex: \`^\${userInput}\` } };
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('$regex'))).toBe(true);
    });
  });

  describe('Safe Patterns', () => {
    it('should accept Prisma ORM methods', async () => {
      const file = path.join(testDir, 'safe-prisma.ts');
      await fs.promises.writeFile(file, `
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const users = await prisma.user.findMany();
        const newUser = await prisma.user.create({ data: { name, email } });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
    });

    it('should accept parameterized pg queries', async () => {
      const file = path.join(testDir, 'safe-pg.ts');
      await fs.promises.writeFile(file, `
        const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
    });

    it('should accept Drizzle query builder', async () => {
      const file = path.join(testDir, 'safe-drizzle.ts');
      await fs.promises.writeFile(file, `
        const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
    });
  });

  describe('Evidence Collection', () => {
    it('should collect evidence for all query patterns', async () => {
      const file = path.join(testDir, 'mixed.ts');
      await fs.promises.writeFile(file, `
        const safe = await prisma.user.findMany();
        const unsafe = await prisma.$queryRaw\`SELECT * FROM users WHERE id = \${id}\`;
        const params = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.evidence.length).toBeGreaterThan(0);
      expect(proof.evidence.some(e => 'safetyLevel' in e && e.safetyLevel === 'safe')).toBe(true);
      expect(proof.evidence.some(e => 'safetyLevel' in e && e.safetyLevel === 'unsafe')).toBe(true);
    });
  });

  describe('Proof Metadata', () => {
    it('should have correct tier and ID', () => {
      expect(prover.tier).toBe(1);
      expect(prover.id).toBe('tier1-sql-injection');
      expect(prover.name).toBe('SQL Injection Prevention');
    });

    it('should include summary with query counts', async () => {
      const file = path.join(testDir, 'test.ts');
      await fs.promises.writeFile(file, `
        const user = await prisma.user.findUnique({ where: { id } });
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.summary).toContain('DB access');
      expect(proof.duration_ms).toBeGreaterThan(0);
    });
  });
});
