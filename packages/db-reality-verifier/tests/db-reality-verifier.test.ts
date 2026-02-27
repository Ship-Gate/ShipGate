import { describe, it, expect } from 'vitest';
import { verifyDatabaseQueries } from '../src/index.js';
import { parsePrismaSchema } from '../src/parsers/prisma.js';
import { parseDrizzleSchema } from '../src/parsers/drizzle.js';
import { parseSqlMigration } from '../src/parsers/sql.js';
import { extractQueriesFromFiles } from '../src/extractors/queries.js';
import { verifyQueries } from '../src/verifier.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('Database Reality Verifier', () => {
  describe('Schema Parsers', () => {
    it('should parse Prisma schema', () => {
      const schemaPath = join(FIXTURES_DIR, 'prisma-schema.prisma');
      const schema = parsePrismaSchema(schemaPath);

      expect(schema.source).toBe('prisma');
      expect(schema.tables).toHaveLength(3);
      expect(schema.tables.find((t) => t.name === 'User')).toBeDefined();
      expect(schema.tables.find((t) => t.name === 'Post')).toBeDefined();
      expect(schema.tables.find((t) => t.name === 'Comment')).toBeDefined();

      const userTable = schema.tables.find((t) => t.name === 'User');
      expect(userTable?.columns).toHaveLength(6);
      expect(userTable?.columns.find((c) => c.name === 'email')).toBeDefined();
      expect(userTable?.columns.find((c) => c.name === 'name')).toBeDefined();
    });

    it('should parse Drizzle schema', () => {
      const schemaPath = join(FIXTURES_DIR, 'drizzle-schema.ts');
      const schema = parseDrizzleSchema(schemaPath);

      expect(schema.source).toBe('drizzle');
      expect(schema.tables).toHaveLength(3);
      expect(schema.tables.find((t) => t.name === 'users')).toBeDefined();
      expect(schema.tables.find((t) => t.name === 'posts')).toBeDefined();
      expect(schema.tables.find((t) => t.name === 'comments')).toBeDefined();
    });

    it('should parse SQL migration', () => {
      const schemaPath = join(FIXTURES_DIR, 'sql-migration.sql');
      const schema = parseSqlMigration(schemaPath);

      expect(schema.source).toBe('sql');
      expect(schema.tables).toHaveLength(3);
      expect(schema.tables.find((t) => t.name === 'users')).toBeDefined();
      expect(schema.tables.find((t) => t.name === 'posts')).toBeDefined();
    });
  });

  describe('Query Extraction', () => {
    it('should extract Prisma queries', async () => {
      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'valid-queries.ts')]);

      expect(queries.length).toBeGreaterThan(0);
      const prismaQueries = queries.filter((q) => q.orm === 'prisma');
      expect(prismaQueries.length).toBeGreaterThan(0);

      const findManyQuery = prismaQueries.find((q) => q.tables.includes('user') && q.type === 'select');
      expect(findManyQuery).toBeDefined();
      expect(findManyQuery?.confidence).toBeGreaterThan(0.9);
    });

    it('should extract Drizzle queries', async () => {
      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'valid-queries.ts')]);

      const drizzleQueries = queries.filter((q) => q.orm === 'drizzle');
      expect(drizzleQueries.length).toBeGreaterThan(0);
    });

    it('should extract SQL template queries', async () => {
      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'valid-queries.ts')]);

      const sqlQueries = queries.filter((q) => q.orm === 'sql-template');
      expect(sqlQueries.length).toBeGreaterThan(0);
    });
  });

  describe('Verification', () => {
    it('should detect missing tables', async () => {
      const schemaPath = join(FIXTURES_DIR, 'prisma-schema.prisma');
      const schema = parsePrismaSchema(schemaPath);

      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'hallucinated-queries.ts')]);

      const result = verifyQueries(schema, queries, {
        schemaFiles: [],
        sourceFiles: [],
        minConfidence: 0.7,
      });

      // Should detect "users" table doesn't exist (should be "User")
      const missingTableMismatch = result.mismatches.find(
        (m) => m.issue === 'missing-table' && m.actual === 'users'
      );
      expect(missingTableMismatch).toBeDefined();
      expect(missingTableMismatch?.severity).toBe('error');
    });

    it('should detect missing columns', async () => {
      const schemaPath = join(FIXTURES_DIR, 'prisma-schema.prisma');
      const schema = parsePrismaSchema(schemaPath);

      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'hallucinated-queries.ts')]);

      const result = verifyQueries(schema, queries, {
        schemaFiles: [],
        sourceFiles: [],
        minConfidence: 0.7,
      });

      // Should detect "username" column doesn't exist
      const missingColumnMismatch = result.mismatches.find(
        (m) => m.issue === 'missing-column' && m.actual === 'username'
      );
      expect(missingColumnMismatch).toBeDefined();
      expect(missingColumnMismatch?.severity).toBe('warning');
    });

    it('should provide typo suggestions', async () => {
      const schemaPath = join(FIXTURES_DIR, 'prisma-schema.prisma');
      const schema = parsePrismaSchema(schemaPath);

      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'hallucinated-queries.ts')]);

      const result = verifyQueries(schema, queries, {
        schemaFiles: [],
        sourceFiles: [],
        minConfidence: 0.7,
        maxSuggestions: 3,
      });

      // Should suggest "Comment" for "commment" typo
      const typoMismatch = result.mismatches.find(
        (m) => m.issue === 'missing-table' && m.actual === 'commment'
      );
      expect(typoMismatch).toBeDefined();
      expect(typoMismatch?.suggestion).toContain('Comment');
    });

    it('should respect confidence gating', async () => {
      const schemaPath = join(FIXTURES_DIR, 'prisma-schema.prisma');
      const schema = parsePrismaSchema(schemaPath);

      const queries = await extractQueriesFromFiles([join(FIXTURES_DIR, 'hallucinated-queries.ts')]);

      // With high confidence threshold, should filter out low-confidence queries
      const resultHigh = verifyQueries(schema, queries, {
        schemaFiles: [],
        sourceFiles: [],
        minConfidence: 0.95,
      });

      const resultLow = verifyQueries(schema, queries, {
        schemaFiles: [],
        sourceFiles: [],
        minConfidence: 0.5,
      });

      // High threshold should have fewer mismatches (filters out dynamic queries)
      expect(resultHigh.mismatches.length).toBeLessThanOrEqual(resultLow.mismatches.length);
    });
  });

  describe('End-to-end', () => {
    it('should verify queries against Prisma schema', async () => {
      const result = await verifyDatabaseQueries({
        schemaFiles: [join(FIXTURES_DIR, 'prisma-schema.prisma')],
        sourceFiles: [join(FIXTURES_DIR, 'hallucinated-queries.ts')],
        minConfidence: 0.7,
      });

      expect(result.schema).toBeDefined();
      expect(result.mismatches.length).toBeGreaterThan(0);
      expect(result.totalQueries).toBeGreaterThan(0);
    });

    it('should verify queries against Drizzle schema', async () => {
      const result = await verifyDatabaseQueries({
        schemaFiles: [join(FIXTURES_DIR, 'drizzle-schema.ts')],
        sourceFiles: [join(FIXTURES_DIR, 'hallucinated-queries.ts')],
        minConfidence: 0.7,
      });

      expect(result.schema).toBeDefined();
      expect(result.mismatches.length).toBeGreaterThan(0);
    });
  });
});
