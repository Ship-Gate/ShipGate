// ============================================================================
// Database Migration Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import type * as AST from '@isl-lang/isl-core';

const mockDomain: AST.Domain = {
  name: 'Users',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }] },
        { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'unique' }, { name: 'indexed' }] },
        { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        { name: 'age', type: { kind: 'primitive', name: 'Int' }, optional: true, annotations: [] },
        { name: 'status', type: { kind: 'reference', name: 'UserStatus' }, optional: false, annotations: [] },
      ],
      invariants: [],
      annotations: [],
    },
    {
      name: 'Post',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }] },
        { name: 'title', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        { name: 'content', type: { kind: 'primitive', name: 'Text' }, optional: false, annotations: [] },
        { name: 'authorId', type: { kind: 'reference', name: 'User' }, optional: false, annotations: [] },
      ],
      invariants: [],
      annotations: [],
    },
  ],
  types: [
    {
      name: 'UserStatus',
      definition: {
        kind: 'enum',
        values: [{ name: 'PENDING' }, { name: 'ACTIVE' }, { name: 'SUSPENDED' }],
      },
      constraints: [],
      annotations: [],
    },
  ],
  behaviors: [],
  scenarios: [],
  policies: [],
  annotations: [],
};

describe('PostgreSQL Migration Generation', () => {
  it('should generate migration files', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
    });

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.type === 'migration')).toBe(true);
    expect(files.some((f) => f.type === 'schema')).toBe(true);
  });

  it('should generate CREATE TABLE statements', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('CREATE TABLE');
    expect(migration?.content).toContain('"user"');
    expect(migration?.content).toContain('"post"');
  });

  it('should create enum types', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('CREATE TYPE');
    expect(migration?.content).toContain('"UserStatus"');
    expect(migration?.content).toContain("'PENDING'");
    expect(migration?.content).toContain("'ACTIVE'");
  });

  it('should handle UUID columns with default', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('UUID');
    expect(migration?.content).toContain('gen_random_uuid()');
  });

  it('should create indexes for indexed fields', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('CREATE');
    expect(migration?.content).toContain('INDEX');
    expect(migration?.content).toContain('idx_user_email');
  });

  it('should create unique constraints', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('UNIQUE');
    expect(migration?.content).toContain('user_email_unique');
  });

  it('should create foreign key constraints', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('FOREIGN KEY');
    expect(migration?.content).toContain('REFERENCES');
    expect(migration?.content).toContain('"user"');
  });

  it('should handle nullable columns', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    // age is optional, should not have NOT NULL
    expect(migration?.content).toContain('"age"');
    // The schema.json will show nullable: true for age
    const schema = files.find((f) => f.type === 'schema');
    const schemaData = JSON.parse(schema!.content);
    const userTable = schemaData.tables.find((t: {name: string}) => t.name === 'user');
    const ageColumn = userTable.columns.find((c: {name: string}) => c.name === 'age');
    expect(ageColumn.nullable).toBe(true);
  });

  it('should use schema prefix when provided', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      schemaName: 'myapp',
    });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('myapp.');
  });

  it('should include timestamps when configured', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      includeTimestamps: true,
    });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('created_at');
    expect(migration?.content).toContain('updated_at');
    expect(migration?.content).toContain('CURRENT_TIMESTAMP');
  });

  it('should include soft delete when configured', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      includeSoftDelete: true,
    });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('deleted_at');
  });
});

describe('MySQL Migration Generation', () => {
  it('should generate MySQL-specific syntax', () => {
    const files = generate(mockDomain, { dialect: 'mysql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('ENGINE=InnoDB');
    expect(migration?.content).toContain('utf8mb4');
  });

  it('should use backticks for identifiers', () => {
    const files = generate(mockDomain, { dialect: 'mysql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('`user`');
    expect(migration?.content).toContain('`id`');
  });

  it('should use MySQL-specific types', () => {
    const files = generate(mockDomain, { dialect: 'mysql' });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.content).toContain('CHAR(36)'); // UUID -> CHAR(36)
    expect(migration?.content).toContain('VARCHAR(255)'); // String -> VARCHAR
    expect(migration?.content).toContain('INT'); // Int -> INT
  });
});

describe('Rollback Generation', () => {
  it('should generate rollback migration when requested', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      generateRollback: true,
    });

    expect(files.some((f) => f.path.includes('rollback'))).toBe(true);
  });

  it('should include DROP TABLE in rollback', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      generateRollback: true,
    });
    const rollback = files.find((f) => f.path.includes('rollback'));

    expect(rollback?.content).toContain('DROP TABLE');
  });

  it('should include DROP TYPE for enums in rollback', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      generateRollback: true,
    });
    const rollback = files.find((f) => f.path.includes('rollback'));

    expect(rollback?.content).toContain('DROP TYPE');
  });
});

describe('Schema Snapshot', () => {
  it('should generate schema.json', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const schemaFile = files.find((f) => f.path === 'schema.json');

    expect(schemaFile).toBeDefined();
    
    const schema = JSON.parse(schemaFile!.content);
    expect(schema.tables).toBeDefined();
    expect(schema.enums).toBeDefined();
  });

  it('should capture all tables in schema', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const schemaFile = files.find((f) => f.path === 'schema.json');
    const schema = JSON.parse(schemaFile!.content);

    expect(schema.tables.length).toBe(2);
    expect(schema.tables.some((t: {name: string}) => t.name === 'user')).toBe(true);
    expect(schema.tables.some((t: {name: string}) => t.name === 'post')).toBe(true);
  });

  it('should capture enum definitions', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const schemaFile = files.find((f) => f.path === 'schema.json');
    const schema = JSON.parse(schemaFile!.content);

    expect(schema.enums.length).toBe(1);
    expect(schema.enums[0].name).toBe('UserStatus');
    expect(schema.enums[0].values).toContain('ACTIVE');
  });
});

describe('Migration Naming', () => {
  it('should use timestamp naming by default', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const migration = files.find((f) => f.type === 'migration');

    // Should match pattern like: 20240101_120000_initial_schema.sql
    expect(migration?.path).toMatch(/^\d{8}_\d{6}_.*\.sql$/);
  });

  it('should use sequential naming when configured', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      namingPattern: 'sequential',
    });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.path).toMatch(/^001_.*\.sql$/);
  });

  it('should use descriptive naming when configured', () => {
    const files = generate(mockDomain, {
      dialect: 'postgresql',
      namingPattern: 'descriptive',
    });
    const migration = files.find((f) => f.type === 'migration');

    expect(migration?.path).toBe('initial_schema.sql');
  });
});

describe('Table Naming', () => {
  it('should convert entity names to snake_case', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const schemaFile = files.find((f) => f.path === 'schema.json');
    const schema = JSON.parse(schemaFile!.content);

    // User -> user, Post -> post
    expect(schema.tables.some((t: {name: string}) => t.name === 'user')).toBe(true);
    expect(schema.tables.some((t: {name: string}) => t.name === 'post')).toBe(true);
  });

  it('should convert field names to snake_case', () => {
    const files = generate(mockDomain, { dialect: 'postgresql' });
    const schemaFile = files.find((f) => f.path === 'schema.json');
    const schema = JSON.parse(schemaFile!.content);

    const postTable = schema.tables.find((t: {name: string}) => t.name === 'post');
    expect(postTable.columns.some((c: {name: string}) => c.name === 'author_id')).toBe(true);
  });
});
