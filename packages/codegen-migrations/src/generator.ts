// ============================================================================
// Database Migration Generator
// Transforms ISL domains into database migrations
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type {
  GenerateOptions,
  GeneratedFile,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  EnumDefinition,
  ConstraintDefinition,
  SchemaSnapshot,
  MigrationChange,
} from './types';
import * as postgres from './dialects/postgresql';
import * as mysql from './dialects/mysql';

/**
 * Generate database migrations from ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const format = options.format || 'sql';
  const timestamp = generateTimestamp();

  // Extract schema from domain
  const schema = extractSchema(domain, options);

  // If we have an existing schema, generate diff migrations
  if (options.existingSchema) {
    const changes = diffSchemas(options.existingSchema, schema);
    if (changes.length > 0) {
      const migration = generateMigrationFromChanges(changes, options, timestamp);
      files.push(migration);

      if (options.generateRollback) {
        const rollback = generateRollbackFromChanges(changes, options, timestamp);
        files.push(rollback);
      }
    }
  } else {
    // Generate initial schema migration
    files.push(generateInitialMigration(schema, options, timestamp));

    if (options.generateRollback) {
      files.push(generateRollbackMigration(schema, options, timestamp));
    }
  }

  // Generate schema snapshot file
  files.push({
    path: 'schema.json',
    content: JSON.stringify(schema, null, 2),
    type: 'schema',
  });

  return files;
}

/**
 * Extract schema from ISL domain
 */
function extractSchema(domain: AST.Domain, options: GenerateOptions): SchemaSnapshot {
  const tables: TableDefinition[] = [];
  const enums: EnumDefinition[] = [];
  const indexes: IndexDefinition[] = [];
  const constraints: ConstraintDefinition[] = [];

  // Extract enums from type declarations
  for (const typeDecl of domain.types || []) {
    if (typeDecl.definition.kind === 'enum') {
      enums.push({
        name: typeDecl.name,
        values: typeDecl.definition.values.map((v) => v.name),
      });
    }
  }

  // Extract tables from entities
  for (const entity of domain.entities || []) {
    const table = extractTableFromEntity(entity, domain, options);
    tables.push(table);

    // Extract indexes and constraints
    indexes.push(...(table.indexes || []));
    constraints.push(...(table.constraints || []));
  }

  return { tables, enums, indexes, constraints };
}

/**
 * Extract table definition from entity
 */
function extractTableFromEntity(
  entity: AST.Entity,
  domain: AST.Domain,
  options: GenerateOptions
): TableDefinition {
  const tableName = toSnakeCase(entity.name);
  const columns: ColumnDefinition[] = [];
  const tableIndexes: IndexDefinition[] = [];
  const tableConstraints: ConstraintDefinition[] = [];
  const primaryKey: string[] = [];

  for (const field of entity.fields) {
    const column = extractColumnFromField(field, domain, options);
    columns.push(column);

    // Check for primary key
    const isPK = field.annotations?.some((a) => a.name === 'primary' || a.name === 'id');
    const isImmutableId = field.name === 'id' && field.annotations?.some((a) => a.name === 'immutable');
    
    if (isPK || isImmutableId) {
      primaryKey.push(column.name);
    }

    // Check for unique constraint
    if (field.annotations?.some((a) => a.name === 'unique')) {
      tableConstraints.push({
        name: `${tableName}_${column.name}_unique`,
        table: tableName,
        type: 'unique',
        columns: [column.name],
      });
    }

    // Check for indexed annotation
    if (field.annotations?.some((a) => a.name === 'indexed')) {
      tableIndexes.push({
        name: `idx_${tableName}_${column.name}`,
        table: tableName,
        columns: [column.name],
      });
    }

    // Check for foreign key (reference to another entity)
    if (field.type.kind === 'reference') {
      const refEntity = domain.entities?.find((e) => e.name === field.type.name);
      if (refEntity) {
        tableConstraints.push({
          name: `fk_${tableName}_${column.name}`,
          table: tableName,
          type: 'foreign_key',
          columns: [column.name],
          references: {
            table: toSnakeCase(refEntity.name),
            column: 'id',
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        });
      }
    }
  }

  // Add timestamps if configured
  if (options.includeTimestamps) {
    columns.push({
      name: 'created_at',
      type: 'Timestamp',
      nullable: false,
      default: 'CURRENT_TIMESTAMP',
    });
    columns.push({
      name: 'updated_at',
      type: 'Timestamp',
      nullable: false,
      default: 'CURRENT_TIMESTAMP',
    });
  }

  // Add soft delete if configured
  if (options.includeSoftDelete) {
    columns.push({
      name: 'deleted_at',
      type: 'Timestamp',
      nullable: true,
    });
  }

  return {
    name: tableName,
    columns,
    primaryKey: primaryKey.length > 0 ? primaryKey : ['id'],
    indexes: tableIndexes,
    constraints: tableConstraints,
  };
}

/**
 * Extract column definition from field
 */
function extractColumnFromField(
  field: AST.Field,
  domain: AST.Domain,
  options: GenerateOptions
): ColumnDefinition {
  const columnName = toSnakeCase(field.name);
  let columnType = resolveColumnType(field.type, domain);
  let nullable = field.optional || false;
  let defaultValue: string | undefined;

  // Handle annotations
  for (const annotation of field.annotations || []) {
    if (annotation.name === 'default' && annotation.args) {
      defaultValue = formatDefaultValue(annotation.args[0]);
    }
  }

  // UUID fields often have auto-generation
  if (field.type.kind === 'primitive' && field.type.name === 'UUID') {
    if (options.dialect === 'postgresql') {
      defaultValue = defaultValue || 'gen_random_uuid()';
    }
  }

  return {
    name: columnName,
    type: columnType,
    nullable,
    default: defaultValue,
    primaryKey: field.name === 'id',
    unique: field.annotations?.some((a) => a.name === 'unique'),
  };
}

/**
 * Resolve column type from ISL type expression
 */
function resolveColumnType(type: AST.TypeExpression, domain: AST.Domain): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'reference':
      // Check if it's an enum
      const typeDecl = domain.types?.find((t) => t.name === type.name);
      if (typeDecl?.definition.kind === 'enum') {
        return type.name; // Will be handled as enum
      }
      // Otherwise it's a foreign key reference - use UUID
      return 'UUID';
    case 'optional':
      return resolveColumnType(type.innerType, domain);
    case 'list':
      return 'JSON'; // Store arrays as JSON
    case 'map':
      return 'JSON'; // Store maps as JSON
    default:
      return 'String';
  }
}

/**
 * Format default value for SQL
 */
function formatDefaultValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value === null) {
    return 'NULL';
  }
  return String(value);
}

/**
 * Diff two schemas to generate changes
 */
function diffSchemas(oldSchema: SchemaSnapshot, newSchema: SchemaSnapshot): MigrationChange[] {
  const changes: MigrationChange[] = [];

  // Find new enums
  for (const newEnum of newSchema.enums) {
    const oldEnum = oldSchema.enums.find((e) => e.name === newEnum.name);
    if (!oldEnum) {
      changes.push({
        type: 'create_enum',
        target: newEnum.name,
        details: { values: newEnum.values },
      });
    }
  }

  // Find new tables
  for (const newTable of newSchema.tables) {
    const oldTable = oldSchema.tables.find((t) => t.name === newTable.name);
    if (!oldTable) {
      changes.push({
        type: 'create_table',
        target: newTable.name,
        details: { table: newTable },
      });
    } else {
      // Diff columns
      for (const newCol of newTable.columns) {
        const oldCol = oldTable.columns.find((c) => c.name === newCol.name);
        if (!oldCol) {
          changes.push({
            type: 'add_column',
            target: newTable.name,
            details: { column: newCol },
          });
        } else if (JSON.stringify(oldCol) !== JSON.stringify(newCol)) {
          changes.push({
            type: 'alter_column',
            target: newTable.name,
            details: { columnName: newCol.name, oldColumn: oldCol, newColumn: newCol },
          });
        }
      }

      // Find removed columns
      for (const oldCol of oldTable.columns) {
        const newCol = newTable.columns.find((c) => c.name === oldCol.name);
        if (!newCol) {
          changes.push({
            type: 'drop_column',
            target: newTable.name,
            details: { columnName: oldCol.name },
          });
        }
      }
    }
  }

  // Find removed tables
  for (const oldTable of oldSchema.tables) {
    const newTable = newSchema.tables.find((t) => t.name === oldTable.name);
    if (!newTable) {
      changes.push({
        type: 'drop_table',
        target: oldTable.name,
        details: {},
      });
    }
  }

  return changes;
}

/**
 * Generate initial migration
 */
function generateInitialMigration(
  schema: SchemaSnapshot,
  options: GenerateOptions,
  timestamp: string
): GeneratedFile {
  const lines: string[] = [];
  const dialect = options.dialect;

  lines.push('-- Migration: Initial schema');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Create enums first (PostgreSQL only)
  if (dialect === 'postgresql') {
    for (const enumDef of schema.enums) {
      lines.push(postgres.generateCreateEnum(enumDef, options));
      lines.push('');
    }
  }

  // Create tables
  for (const table of schema.tables) {
    if (dialect === 'postgresql') {
      lines.push(postgres.generateCreateTable(table, options));
    } else if (dialect === 'mysql') {
      lines.push(mysql.generateCreateTable(table, options));
    }
    lines.push('');
  }

  const filename = formatMigrationFilename('initial_schema', timestamp, options);

  return {
    path: filename,
    content: lines.join('\n'),
    type: 'migration',
  };
}

/**
 * Generate rollback migration
 */
function generateRollbackMigration(
  schema: SchemaSnapshot,
  options: GenerateOptions,
  timestamp: string
): GeneratedFile {
  const lines: string[] = [];
  const dialect = options.dialect;

  lines.push('-- Rollback: Initial schema');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Drop tables in reverse order
  for (const table of [...schema.tables].reverse()) {
    if (dialect === 'postgresql') {
      lines.push(postgres.generateDropTable(table.name, options));
    } else if (dialect === 'mysql') {
      lines.push(mysql.generateDropTable(table.name, options));
    }
  }

  // Drop enums (PostgreSQL only)
  if (dialect === 'postgresql') {
    lines.push('');
    for (const enumDef of schema.enums) {
      const schemaPrefix = options.schemaName ? `${options.schemaName}.` : '';
      lines.push(`DROP TYPE IF EXISTS ${schemaPrefix}"${enumDef.name}";`);
    }
  }

  const filename = formatMigrationFilename('initial_schema_rollback', timestamp, options);

  return {
    path: filename,
    content: lines.join('\n'),
    type: 'migration',
  };
}

/**
 * Generate migration from changes
 */
function generateMigrationFromChanges(
  changes: MigrationChange[],
  options: GenerateOptions,
  timestamp: string
): GeneratedFile {
  const lines: string[] = [];
  const dialect = options.dialect;

  lines.push('-- Migration: Schema changes');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  for (const change of changes) {
    switch (change.type) {
      case 'create_enum':
        if (dialect === 'postgresql') {
          lines.push(postgres.generateCreateEnum(change.details as EnumDefinition, options));
        }
        break;
      case 'create_table':
        const table = change.details.table as TableDefinition;
        if (dialect === 'postgresql') {
          lines.push(postgres.generateCreateTable(table, options));
        } else if (dialect === 'mysql') {
          lines.push(mysql.generateCreateTable(table, options));
        }
        break;
      case 'add_column':
        const column = change.details.column as ColumnDefinition;
        if (dialect === 'postgresql') {
          lines.push(postgres.generateAddColumn(change.target, column, options));
        } else if (dialect === 'mysql') {
          lines.push(mysql.generateAddColumn(change.target, column, options));
        }
        break;
      case 'drop_column':
        if (dialect === 'postgresql') {
          lines.push(postgres.generateDropColumn(change.target, change.details.columnName as string, options));
        } else if (dialect === 'mysql') {
          lines.push(mysql.generateDropColumn(change.target, change.details.columnName as string, options));
        }
        break;
      case 'drop_table':
        if (dialect === 'postgresql') {
          lines.push(postgres.generateDropTable(change.target, options));
        } else if (dialect === 'mysql') {
          lines.push(mysql.generateDropTable(change.target, options));
        }
        break;
    }
    lines.push('');
  }

  const filename = formatMigrationFilename('schema_update', timestamp, options);

  return {
    path: filename,
    content: lines.join('\n'),
    type: 'migration',
  };
}

/**
 * Generate rollback from changes
 */
function generateRollbackFromChanges(
  changes: MigrationChange[],
  options: GenerateOptions,
  timestamp: string
): GeneratedFile {
  const lines: string[] = [];
  
  lines.push('-- Rollback: Schema changes');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Reverse the changes
  for (const change of [...changes].reverse()) {
    switch (change.type) {
      case 'create_table':
        if (options.dialect === 'postgresql') {
          lines.push(postgres.generateDropTable(change.target, options));
        } else if (options.dialect === 'mysql') {
          lines.push(mysql.generateDropTable(change.target, options));
        }
        break;
      case 'add_column':
        if (options.dialect === 'postgresql') {
          lines.push(postgres.generateDropColumn(change.target, (change.details.column as ColumnDefinition).name, options));
        } else if (options.dialect === 'mysql') {
          lines.push(mysql.generateDropColumn(change.target, (change.details.column as ColumnDefinition).name, options));
        }
        break;
      // Note: drop_column rollback would need the old column definition
    }
    lines.push('');
  }

  const filename = formatMigrationFilename('schema_update_rollback', timestamp, options);

  return {
    path: filename,
    content: lines.join('\n'),
    type: 'migration',
  };
}

/**
 * Generate timestamp for migration filename
 */
function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
}

/**
 * Format migration filename
 */
function formatMigrationFilename(
  name: string,
  timestamp: string,
  options: GenerateOptions
): string {
  switch (options.namingPattern) {
    case 'sequential':
      return `001_${name}.sql`;
    case 'descriptive':
      return `${name}.sql`;
    default:
      return `${timestamp}_${name}.sql`;
  }
}

/**
 * Convert to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
