// ============================================================================
// Database Migration Generator Types
// ============================================================================

export type DatabaseDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';

export type MigrationFormat = 'sql' | 'knex' | 'prisma' | 'drizzle' | 'typeorm';

export interface GenerateOptions {
  /** Target database dialect */
  dialect: DatabaseDialect;
  /** Output format */
  format?: MigrationFormat;
  /** Schema name (for PostgreSQL) */
  schemaName?: string;
  /** Table name prefix */
  tablePrefix?: string;
  /** Include timestamps (created_at, updated_at) */
  includeTimestamps?: boolean;
  /** Include soft delete (deleted_at) */
  includeSoftDelete?: boolean;
  /** Generate separate up/down migrations */
  generateRollback?: boolean;
  /** Migration naming pattern */
  namingPattern?: 'timestamp' | 'sequential' | 'descriptive';
  /** Existing schema for diffing */
  existingSchema?: SchemaSnapshot;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'migration' | 'schema' | 'seed';
}

export interface SchemaSnapshot {
  tables: TableDefinition[];
  enums: EnumDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  indexes?: IndexDefinition[];
  constraints?: ConstraintDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  primaryKey?: boolean;
  unique?: boolean;
  references?: ForeignKeyReference;
}

export interface ForeignKeyReference {
  table: string;
  column: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
  where?: string;
}

export interface ConstraintDefinition {
  name: string;
  table: string;
  type: 'check' | 'unique' | 'foreign_key' | 'primary_key';
  columns: string[];
  expression?: string;
  references?: ForeignKeyReference;
}

export interface EnumDefinition {
  name: string;
  values: string[];
}

export interface MigrationChange {
  type: 'create_table' | 'drop_table' | 'add_column' | 'drop_column' | 
        'alter_column' | 'create_index' | 'drop_index' | 'create_enum' |
        'add_constraint' | 'drop_constraint' | 'rename_column' | 'rename_table';
  target: string;
  details: Record<string, unknown>;
}
