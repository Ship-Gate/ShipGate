/**
 * Tests for database codegen
 */

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator.js';
import type { DomainDeclaration } from '@intentos/isl-core';

// Helper to create a minimal source span
const span = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };

// Test domain with User entity
const testDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  span,
  name: { kind: 'Identifier', name: 'TestDomain', span },
  imports: [],
  entities: [
    {
      kind: 'EntityDeclaration',
      span,
      name: { kind: 'Identifier', name: 'User', span },
      fields: [
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'id', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'UUID', span } },
          optional: false,
          annotations: [
            { kind: 'Annotation', span, name: { kind: 'Identifier', name: 'immutable', span } },
            { kind: 'Annotation', span, name: { kind: 'Identifier', name: 'unique', span } },
          ],
          constraints: [],
        },
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'email', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'Email', span } },
          optional: false,
          annotations: [
            { kind: 'Annotation', span, name: { kind: 'Identifier', name: 'unique', span } },
            { kind: 'Annotation', span, name: { kind: 'Identifier', name: 'indexed', span } },
          ],
          constraints: [],
        },
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'username', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'String', span } },
          optional: false,
          annotations: [],
          constraints: [
            {
              kind: 'TypeConstraint',
              span,
              name: { kind: 'Identifier', name: 'min_length', span },
              value: { kind: 'NumberLiteral', span, value: 3 },
            },
            {
              kind: 'TypeConstraint',
              span,
              name: { kind: 'Identifier', name: 'max_length', span },
              value: { kind: 'NumberLiteral', span, value: 30 },
            },
          ],
        },
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'status', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'UserStatus', span } },
          optional: false,
          annotations: [],
          constraints: [],
        },
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'created_at', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'Timestamp', span } },
          optional: false,
          annotations: [
            { kind: 'Annotation', span, name: { kind: 'Identifier', name: 'immutable', span } },
          ],
          constraints: [],
        },
        {
          kind: 'FieldDeclaration',
          span,
          name: { kind: 'Identifier', name: 'updated_at', span },
          type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'Timestamp', span } },
          optional: false,
          annotations: [],
          constraints: [],
        },
      ],
    },
  ],
  types: [],
  enums: [
    {
      kind: 'EnumDeclaration',
      span,
      name: { kind: 'Identifier', name: 'UserStatus', span },
      variants: [
        { kind: 'Identifier', name: 'PENDING', span },
        { kind: 'Identifier', name: 'ACTIVE', span },
        { kind: 'Identifier', name: 'SUSPENDED', span },
      ],
    },
  ],
  behaviors: [],
  invariants: [],
};

describe('Database Codegen', () => {
  describe('Prisma Generator', () => {
    it('should generate valid Prisma schema', () => {
      const files = generate(testDomain, { adapter: 'prisma' });

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('schema.prisma');
      expect(files[0].type).toBe('prisma');

      const content = files[0].content;

      // Check generator and datasource
      expect(content).toContain('generator client');
      expect(content).toContain('datasource db');
      expect(content).toContain('provider = "postgresql"');

      // Check enum
      expect(content).toContain('enum UserStatus {');
      expect(content).toContain('PENDING');
      expect(content).toContain('ACTIVE');
      expect(content).toContain('SUSPENDED');

      // Check model
      expect(content).toContain('model User {');
      expect(content).toContain('@id');
      expect(content).toContain('@default(uuid())');
      expect(content).toContain('@unique');
      expect(content).toContain('@updatedAt');
      expect(content).toContain('@@map("users")');
    });

    it('should handle PostgreSQL provider', () => {
      const files = generate(testDomain, { adapter: 'prisma', provider: 'postgresql' });
      expect(files[0].content).toContain('provider = "postgresql"');
    });

    it('should handle MySQL provider', () => {
      const files = generate(testDomain, { adapter: 'prisma', provider: 'mysql' });
      expect(files[0].content).toContain('provider = "mysql"');
    });

    it('should handle SQLite provider', () => {
      const files = generate(testDomain, { adapter: 'prisma', provider: 'sqlite' });
      expect(files[0].content).toContain('provider = "sqlite"');
    });
  });

  describe('Drizzle Generator', () => {
    it('should generate valid Drizzle schema', () => {
      const files = generate(testDomain, { adapter: 'drizzle' });

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('schema.ts');
      expect(files[0].type).toBe('typescript');

      const content = files[0].content;

      // Check imports
      expect(content).toContain("from 'drizzle-orm/pg-core'");
      expect(content).toContain("from 'drizzle-orm'");

      // Check enum
      expect(content).toContain('userStatusEnum = pgEnum');
      expect(content).toContain("'PENDING'");
      expect(content).toContain("'ACTIVE'");
      expect(content).toContain("'SUSPENDED'");

      // Check table
      expect(content).toContain("pgTable('users'");
      expect(content).toContain('.primaryKey()');
      expect(content).toContain('.defaultRandom()');
      expect(content).toContain('.notNull()');
      expect(content).toContain('.unique()');

      // Check inferred types
      expect(content).toContain('export type User =');
      expect(content).toContain('export type NewUser =');
    });
  });

  describe('TypeORM Generator', () => {
    it('should generate valid TypeORM entities', () => {
      const files = generate(testDomain, { adapter: 'typeorm' });

      // Should have enums file, entity file, and index file
      expect(files.length).toBeGreaterThanOrEqual(2);

      // Check enums file
      const enumsFile = files.find(f => f.path === 'enums.ts');
      expect(enumsFile).toBeDefined();
      expect(enumsFile!.content).toContain('export enum UserStatus');
      expect(enumsFile!.content).toContain("PENDING = 'PENDING'");

      // Check entity file
      const entityFile = files.find(f => f.path === 'entities/User.ts');
      expect(entityFile).toBeDefined();
      expect(entityFile!.content).toContain("import { Entity, Column");
      expect(entityFile!.content).toContain("@Entity('users')");
      expect(entityFile!.content).toContain('export class User');
      expect(entityFile!.content).toContain("@PrimaryGeneratedColumn('uuid')");
      expect(entityFile!.content).toContain('@CreateDateColumn');
      expect(entityFile!.content).toContain('@UpdateDateColumn');
    });
  });

  describe('SQL Generator', () => {
    it('should generate valid SQL schema', () => {
      const files = generate(testDomain, { adapter: 'sql' });

      expect(files).toHaveLength(1);
      expect(files[0].type).toBe('sql');

      const content = files[0].content;

      // Check enum type
      expect(content).toContain('CREATE TYPE');
      expect(content).toContain('AS ENUM');

      // Check table
      expect(content).toContain('CREATE TABLE "users"');
      expect(content).toContain('PRIMARY KEY');
      expect(content).toContain('UNIQUE');
      expect(content).toContain('NOT NULL');

      // Check indexes
      expect(content).toContain('CREATE INDEX');
    });

    it('should generate MySQL-compatible SQL', () => {
      const files = generate(testDomain, { adapter: 'sql', provider: 'mysql' });
      const content = files[0].content;

      // MySQL doesn't have CREATE TYPE for enums
      expect(content).not.toContain('CREATE TYPE');
      expect(content).toContain('CREATE TABLE');
    });

    it('should generate SQLite-compatible SQL', () => {
      const files = generate(testDomain, { adapter: 'sql', provider: 'sqlite' });
      const content = files[0].content;

      expect(content).not.toContain('CREATE TYPE');
      expect(content).toContain('TEXT');
    });
  });

  describe('Repository Generation', () => {
    it('should generate Prisma repositories when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'prisma',
        generateRepository: true,
      });

      // Should have schema + repository files
      expect(files.length).toBeGreaterThan(1);

      const repoFile = files.find(f => f.path.includes('UserRepository.ts'));
      expect(repoFile).toBeDefined();
      expect(repoFile!.content).toContain('interface UserRepository');
      expect(repoFile!.content).toContain('class PrismaUserRepository');
      expect(repoFile!.content).toContain('findById');
      expect(repoFile!.content).toContain('findByEmail');
      expect(repoFile!.content).toContain('create');
      expect(repoFile!.content).toContain('update');
      expect(repoFile!.content).toContain('delete');
    });

    it('should generate Drizzle repositories when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'drizzle',
        generateRepository: true,
      });

      const repoFile = files.find(f => f.path.includes('UserRepository.ts'));
      expect(repoFile).toBeDefined();
      expect(repoFile!.content).toContain('class DrizzleUserRepository');
    });

    it('should generate TypeORM repositories when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'typeorm',
        generateRepository: true,
      });

      const repoFile = files.find(f => f.path.includes('UserRepository.ts'));
      expect(repoFile).toBeDefined();
      expect(repoFile!.content).toContain('class TypeORMUserRepository');
    });
  });

  describe('Migration Generation', () => {
    it('should generate migrations when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'prisma',
        generateMigrations: true,
      });

      const migrationFile = files.find(f => f.path.includes('migrations/'));
      expect(migrationFile).toBeDefined();
    });

    it('should generate TypeORM migrations as TypeScript', () => {
      const files = generate(testDomain, {
        adapter: 'typeorm',
        generateMigrations: true,
      });

      const migrationFile = files.find(f => f.path.includes('migrations/') && f.path.endsWith('.ts'));
      expect(migrationFile).toBeDefined();
      expect(migrationFile!.content).toContain('MigrationInterface');
      expect(migrationFile!.content).toContain('async up');
      expect(migrationFile!.content).toContain('async down');
    });
  });

  describe('Options', () => {
    it('should add soft delete columns when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'prisma',
        softDelete: true,
      });

      expect(files[0].content).toContain('deletedAt');
    });

    it('should add audit columns when enabled', () => {
      const files = generate(testDomain, {
        adapter: 'prisma',
        auditFields: true,
      });

      expect(files[0].content).toContain('createdBy');
      expect(files[0].content).toContain('updatedBy');
    });

    it('should respect table casing option', () => {
      const snakeFiles = generate(testDomain, {
        adapter: 'sql',
        tableCasing: 'snake',
      });
      expect(snakeFiles[0].content).toContain('"users"');
    });
  });

  describe('Field Constraints', () => {
    it('should apply max_length constraint', () => {
      const files = generate(testDomain, { adapter: 'prisma' });
      expect(files[0].content).toContain('@db.VarChar(30)');
    });

    it('should handle nullable fields', () => {
      const domainWithOptional: DomainDeclaration = {
        ...testDomain,
        entities: [
          {
            ...testDomain.entities[0],
            fields: [
              ...testDomain.entities[0].fields,
              {
                kind: 'FieldDeclaration',
                span,
                name: { kind: 'Identifier', name: 'bio', span },
                type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'String', span } },
                optional: true,
                annotations: [],
                constraints: [],
              },
            ],
          },
        ],
      };

      const files = generate(domainWithOptional, { adapter: 'prisma' });
      expect(files[0].content).toContain('bio');
      expect(files[0].content).toMatch(/bio\s+String\?/);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty domain', () => {
    const emptyDomain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      span,
      name: { kind: 'Identifier', name: 'Empty', span },
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [],
      invariants: [],
    };

    const files = generate(emptyDomain, { adapter: 'prisma' });
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain('generator client');
  });

  it('should handle entity without enums', () => {
    const noEnumDomain: DomainDeclaration = {
      ...testDomain,
      enums: [],
      entities: [
        {
          kind: 'EntityDeclaration',
          span,
          name: { kind: 'Identifier', name: 'Simple', span },
          fields: [
            {
              kind: 'FieldDeclaration',
              span,
              name: { kind: 'Identifier', name: 'id', span },
              type: { kind: 'SimpleType', span, name: { kind: 'Identifier', name: 'UUID', span } },
              optional: false,
              annotations: [],
              constraints: [],
            },
          ],
        },
      ],
    };

    const files = generate(noEnumDomain, { adapter: 'prisma' });
    expect(files[0].content).toContain('model Simple');
    expect(files[0].content).not.toContain('enum');
  });
});
