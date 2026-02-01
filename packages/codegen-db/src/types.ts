/**
 * Types for database codegen
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
  Annotation,
  TypeConstraint,
} from '@intentos/isl-core';

// ============================================
// Generator Options
// ============================================

export type DatabaseAdapter = 'prisma' | 'drizzle' | 'typeorm' | 'sql';

export type DatabaseProvider = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

export interface GeneratorOptions {
  /** Target database adapter */
  adapter: DatabaseAdapter;
  
  /** Database provider (affects SQL types) */
  provider?: DatabaseProvider;
  
  /** Generate repository pattern */
  generateRepository?: boolean;
  
  /** Generate migrations */
  generateMigrations?: boolean;
  
  /** Output directory */
  outDir?: string;
  
  /** Table name casing: snake_case, camelCase, PascalCase */
  tableCasing?: 'snake' | 'camel' | 'pascal';
  
  /** Column name casing */
  columnCasing?: 'snake' | 'camel' | 'pascal';
  
  /** Add soft delete support */
  softDelete?: boolean;
  
  /** Add audit fields (createdBy, updatedBy) */
  auditFields?: boolean;
  
  /** Custom type mappings */
  typeMap?: Record<string, string>;
}

// ============================================
// Generated File
// ============================================

export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  
  /** File contents */
  content: string;
  
  /** File type for syntax highlighting */
  type: 'prisma' | 'typescript' | 'sql';
}

// ============================================
// Normalized Entity Model
// ============================================

export interface NormalizedEntity {
  name: string;
  tableName: string;
  fields: NormalizedField[];
  indexes: IndexDefinition[];
  uniqueConstraints: UniqueConstraint[];
  relations: RelationDefinition[];
}

export interface NormalizedField {
  name: string;
  columnName: string;
  type: FieldType;
  nullable: boolean;
  unique: boolean;
  indexed: boolean;
  immutable: boolean;
  primaryKey: boolean;
  autoGenerate: boolean;
  defaultValue?: DefaultValue;
  constraints: FieldConstraints;
  rawType: TypeExpression;
}

export interface FieldType {
  kind: 'scalar' | 'enum' | 'relation' | 'json';
  name: string;
  isArray: boolean;
  /** For scalar types: String, Int, Float, Boolean, DateTime, etc. */
  scalarType?: ScalarType;
  /** For enum types: reference to enum name */
  enumName?: string;
  /** For relation types */
  relationTarget?: string;
}

export type ScalarType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'DateTime'
  | 'UUID'
  | 'BigInt'
  | 'Decimal'
  | 'Bytes'
  | 'Json';

export interface DefaultValue {
  kind: 'literal' | 'function' | 'expression';
  value: string | number | boolean | null;
  function?: 'now' | 'uuid' | 'cuid' | 'autoincrement' | 'dbgenerated';
}

export interface FieldConstraints {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  precision?: number;
  scale?: number;
}

export interface IndexDefinition {
  name?: string;
  fields: string[];
  unique: boolean;
}

export interface UniqueConstraint {
  name?: string;
  fields: string[];
}

export interface RelationDefinition {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  foreignKey?: string;
  references?: string;
  onDelete?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
  onUpdate?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
}

// ============================================
// Normalized Enum
// ============================================

export interface NormalizedEnum {
  name: string;
  dbName: string;
  values: string[];
}

// ============================================
// Context for Generation
// ============================================

export interface GeneratorContext {
  domain: DomainDeclaration;
  options: GeneratorOptions;
  entities: NormalizedEntity[];
  enums: NormalizedEnum[];
}

// ============================================
// Adapter Interface
// ============================================

export interface DatabaseAdapterGenerator {
  /** Generate schema file(s) */
  generateSchema(context: GeneratorContext): GeneratedFile[];
  
  /** Generate repository classes */
  generateRepositories?(context: GeneratorContext): GeneratedFile[];
  
  /** Get file extension for this adapter */
  getFileExtension(): string;
}

// ============================================
// Type Mapping
// ============================================

export interface TypeMapping {
  prisma: string;
  drizzle: string;
  typeorm: string;
  postgresql: string;
  mysql: string;
  sqlite: string;
}

export const TYPE_MAPPINGS: Record<string, Partial<TypeMapping>> = {
  String: {
    prisma: 'String',
    drizzle: 'varchar',
    typeorm: 'varchar',
    postgresql: 'VARCHAR',
    mysql: 'VARCHAR',
    sqlite: 'TEXT',
  },
  Int: {
    prisma: 'Int',
    drizzle: 'integer',
    typeorm: 'int',
    postgresql: 'INTEGER',
    mysql: 'INT',
    sqlite: 'INTEGER',
  },
  Float: {
    prisma: 'Float',
    drizzle: 'real',
    typeorm: 'float',
    postgresql: 'REAL',
    mysql: 'FLOAT',
    sqlite: 'REAL',
  },
  Boolean: {
    prisma: 'Boolean',
    drizzle: 'boolean',
    typeorm: 'boolean',
    postgresql: 'BOOLEAN',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
  },
  DateTime: {
    prisma: 'DateTime',
    drizzle: 'timestamp',
    typeorm: 'timestamp',
    postgresql: 'TIMESTAMP',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
  },
  Timestamp: {
    prisma: 'DateTime',
    drizzle: 'timestamp',
    typeorm: 'timestamp',
    postgresql: 'TIMESTAMP',
    mysql: 'DATETIME',
    sqlite: 'TEXT',
  },
  UUID: {
    prisma: 'String',
    drizzle: 'uuid',
    typeorm: 'uuid',
    postgresql: 'UUID',
    mysql: 'VARCHAR(36)',
    sqlite: 'TEXT',
  },
  Email: {
    prisma: 'String',
    drizzle: 'varchar',
    typeorm: 'varchar',
    postgresql: 'VARCHAR(254)',
    mysql: 'VARCHAR(254)',
    sqlite: 'TEXT',
  },
  BigInt: {
    prisma: 'BigInt',
    drizzle: 'bigint',
    typeorm: 'bigint',
    postgresql: 'BIGINT',
    mysql: 'BIGINT',
    sqlite: 'INTEGER',
  },
  Decimal: {
    prisma: 'Decimal',
    drizzle: 'decimal',
    typeorm: 'decimal',
    postgresql: 'DECIMAL',
    mysql: 'DECIMAL',
    sqlite: 'REAL',
  },
  Json: {
    prisma: 'Json',
    drizzle: 'json',
    typeorm: 'json',
    postgresql: 'JSONB',
    mysql: 'JSON',
    sqlite: 'TEXT',
  },
  Bytes: {
    prisma: 'Bytes',
    drizzle: 'bytea',
    typeorm: 'bytea',
    postgresql: 'BYTEA',
    mysql: 'BLOB',
    sqlite: 'BLOB',
  },
};
