/**
 * Tests for Migration Generators
 */

import { describe, it, expect } from 'vitest';
import type { DomainDiff, EntityDiff, FieldChange } from '../src/types.js';
import { generateSqlMigration } from '../src/generators/sql.js';
import { generatePrismaMigration } from '../src/generators/prisma.js';
import { generateDrizzleMigration } from '../src/generators/drizzle.js';
import { generateKnexMigration } from '../src/generators/knex.js';

// Helper to create test diff
function createTestDiff(entities: EntityDiff[]): DomainDiff {
  return {
    domain: 'TestDomain',
    oldVersion: '1.0.0',
    newVersion: '1.1.0',
    entities,
    enums: [],
    types: [],
    breaking: entities.some(e => e.type === 'removed'),
    stats: {
      entitiesAdded: entities.filter(e => e.type === 'added').length,
      entitiesRemoved: entities.filter(e => e.type === 'removed').length,
      entitiesModified: entities.filter(e => e.type === 'modified').length,
      fieldsAdded: 0,
      fieldsRemoved: 0,
      fieldsModified: 0,
      enumsAdded: 0,
      enumsRemoved: 0,
      enumsModified: 0,
    },
  };
}

describe('generateSqlMigration', () => {
  it('should generate CREATE TABLE for added entity', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: false },
        { type: 'added', field: 'name', newType: 'String', nullable: false },
        { type: 'added', field: 'email', newType: 'Email', nullable: true },
      ],
    }]);
    
    const result = generateSqlMigration(diff, { dialect: 'postgresql' });
    
    expect(result.up).toContain('CREATE TABLE');
    expect(result.up).toContain('"user"');
    expect(result.up).toContain('"id"');
    expect(result.up).toContain('"name"');
    expect(result.up).toContain('UUID');
    expect(result.up).toContain('TEXT');
    expect(result.down).toContain('DROP TABLE');
  });
  
  it('should generate DROP TABLE for removed entity', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const result = generateSqlMigration(diff, { dialect: 'postgresql' });
    
    expect(result.up).toContain('DROP TABLE');
    expect(result.up).toContain('"user"');
    expect(result.up).toContain('WARNING');
  });
  
  it('should generate ALTER TABLE for modified entity', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'added', field: 'phone', newType: 'String', nullable: true },
      ],
    }]);
    
    const result = generateSqlMigration(diff, { dialect: 'postgresql' });
    
    expect(result.up).toContain('ALTER TABLE');
    expect(result.up).toContain('ADD COLUMN');
    expect(result.up).toContain('"phone"');
  });
  
  it('should support different SQL dialects', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'Int', nullable: false },
      ],
    }]);
    
    const pgResult = generateSqlMigration(diff, { dialect: 'postgresql' });
    const mysqlResult = generateSqlMigration(diff, { dialect: 'mysql' });
    
    expect(pgResult.up).toContain('INTEGER');
    expect(mysqlResult.up).toContain('INT');
  });
  
  it('should include metadata in output', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const result = generateSqlMigration(diff);
    
    expect(result.metadata.generator).toBe('sql');
    expect(result.metadata.domain).toBe('TestDomain');
    expect(result.metadata.tablesAffected).toContain('user');
  });
});

describe('generatePrismaMigration', () => {
  it('should generate Prisma-compatible CREATE TABLE', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: false },
        { type: 'added', field: 'createdAt', newType: 'DateTime', nullable: false },
      ],
    }]);
    
    const result = generatePrismaMigration(diff);
    
    expect(result.up).toContain('-- CreateTable');
    expect(result.up).toContain('CREATE TABLE "user"');
    expect(result.up).toContain('TIMESTAMP');
    expect(result.metadata.generator).toBe('prisma');
  });
  
  it('should generate Prisma rollback migration', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const result = generatePrismaMigration(diff);
    
    expect(result.down).toContain('-- DropTable');
    expect(result.down).toContain('DROP TABLE');
  });
});

describe('generateDrizzleMigration', () => {
  it('should generate Drizzle TypeScript migration', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: false },
        { type: 'added', field: 'name', newType: 'String', nullable: false },
      ],
    }]);
    
    const result = generateDrizzleMigration(diff, { dialect: 'postgresql' });
    
    expect(result.up).toContain('import');
    expect(result.up).toContain('drizzle-orm/pg-core');
    expect(result.up).toContain('export async function up');
    expect(result.up).toContain('pgTable');
    expect(result.metadata.generator).toBe('drizzle');
  });
  
  it('should support MySQL dialect', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'Int', nullable: false }],
    }]);
    
    const result = generateDrizzleMigration(diff, { dialect: 'mysql' });
    
    expect(result.up).toContain('drizzle-orm/mysql-core');
    expect(result.up).toContain('mysqlTable');
  });
});

describe('generateKnexMigration', () => {
  it('should generate Knex JavaScript migration', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: false },
        { type: 'added', field: 'email', newType: 'Email', nullable: false },
      ],
    }]);
    
    const result = generateKnexMigration(diff);
    
    expect(result.up).toContain('exports.up');
    expect(result.up).toContain('knex.schema.createTable');
    expect(result.up).toContain("'user'");
    expect(result.up).toContain('table.uuid');
    expect(result.up).toContain('table.string');
    expect(result.metadata.generator).toBe('knex');
  });
  
  it('should generate Knex rollback', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const result = generateKnexMigration(diff);
    
    expect(result.down).toContain('exports.down');
    expect(result.down).toContain('dropTableIfExists');
  });
  
  it('should handle column modifications', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { 
          type: 'modified', 
          field: 'age', 
          oldType: 'Int', 
          newType: 'String',
        },
      ],
    }]);
    
    const result = generateKnexMigration(diff);
    
    expect(result.up).toContain('alterTable');
    expect(result.up).toContain('.alter()');
  });
});

describe('Generator Options', () => {
  it('should respect includeComments option', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const withComments = generateSqlMigration(diff, { includeComments: true });
    const withoutComments = generateSqlMigration(diff, { includeComments: false });
    
    expect(withComments.up).toContain('-- Migration:');
    expect(withoutComments.up).not.toContain('-- Migration:');
  });
  
  it('should respect tablePrefix option', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const result = generateSqlMigration(diff, { tablePrefix: 'app_' });
    
    expect(result.up).toContain('"app_user"');
  });
  
  it('should respect schema option', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const result = generateSqlMigration(diff, { schema: 'public' });
    
    expect(result.up).toContain('"public"."user"');
  });
});
