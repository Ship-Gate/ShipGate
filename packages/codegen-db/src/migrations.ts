/**
 * Migration Generator
 */

import type {
  GeneratorContext,
  GeneratedFile,
  NormalizedEntity,
  NormalizedEnum,
  NormalizedField,
} from './types.js';

export function generateMigrations(context: GeneratorContext): GeneratedFile[] {
  const { options } = context;
  const timestamp = generateTimestamp();

  switch (options.adapter) {
    case 'prisma':
      return generatePrismaMigration(context, timestamp);
    case 'drizzle':
      return generateDrizzleMigration(context, timestamp);
    case 'typeorm':
      return generateTypeORMMigration(context, timestamp);
    case 'sql':
      return generateSQLMigration(context, timestamp);
    default:
      return [];
  }
}

// ============================================
// Prisma Migration
// ============================================

function generatePrismaMigration(context: GeneratorContext, timestamp: string): GeneratedFile[] {
  // Prisma migrations are typically managed by `prisma migrate dev`
  // We generate a placeholder SQL migration for reference
  const lines: string[] = [];
  const provider = context.options.provider || 'postgresql';

  lines.push('-- Prisma Migration');
  lines.push(`-- Created: ${new Date().toISOString()}`);
  lines.push('-- This migration was auto-generated from ISL schema');
  lines.push('');
  lines.push('-- Note: Run `npx prisma migrate dev` to apply migrations');
  lines.push('');

  // Generate schema SQL
  lines.push(...generateSchemaSql(context));

  return [{
    path: `migrations/${timestamp}_initial/migration.sql`,
    content: lines.join('\n'),
    type: 'sql',
  }];
}

// ============================================
// Drizzle Migration
// ============================================

function generateDrizzleMigration(context: GeneratorContext, timestamp: string): GeneratedFile[] {
  const lines: string[] = [];

  lines.push('-- Drizzle Migration');
  lines.push(`-- Created: ${new Date().toISOString()}`);
  lines.push('');

  // Generate schema SQL
  lines.push(...generateSchemaSql(context));

  return [{
    path: `migrations/${timestamp}_initial.sql`,
    content: lines.join('\n'),
    type: 'sql',
  }];
}

// ============================================
// TypeORM Migration
// ============================================

function generateTypeORMMigration(context: GeneratorContext, timestamp: string): GeneratedFile[] {
  const lines: string[] = [];
  const className = `Initial${timestamp}`;

  lines.push("import { MigrationInterface, QueryRunner } from 'typeorm';");
  lines.push('');
  lines.push(`export class ${className} implements MigrationInterface {`);
  lines.push(`  name = '${className}';`);
  lines.push('');

  // Up migration
  lines.push('  public async up(queryRunner: QueryRunner): Promise<void> {');
  
  const upSql = generateSchemaSql(context);
  for (const sql of upSql) {
    if (sql.trim() && !sql.startsWith('--')) {
      lines.push(`    await queryRunner.query(\`${escapeSql(sql)}\`);`);
    }
  }
  
  lines.push('  }');
  lines.push('');

  // Down migration
  lines.push('  public async down(queryRunner: QueryRunner): Promise<void> {');
  
  // Drop tables in reverse order
  for (const entity of [...context.entities].reverse()) {
    lines.push(`    await queryRunner.query(\`DROP TABLE IF EXISTS "${entity.tableName}" CASCADE\`);`);
  }
  
  // Drop enums (PostgreSQL)
  if (context.options.provider === 'postgresql') {
    for (const enumDef of context.enums) {
      lines.push(`    await queryRunner.query(\`DROP TYPE IF EXISTS "${enumDef.dbName}" CASCADE\`);`);
    }
  }
  
  lines.push('  }');
  lines.push('}');

  return [{
    path: `migrations/${timestamp}-initial.ts`,
    content: lines.join('\n'),
    type: 'typescript',
  }];
}

// ============================================
// SQL Migration
// ============================================

function generateSQLMigration(context: GeneratorContext, timestamp: string): GeneratedFile[] {
  const upLines: string[] = [];
  const downLines: string[] = [];

  upLines.push('-- Up Migration');
  upLines.push(`-- Created: ${new Date().toISOString()}`);
  upLines.push('');
  upLines.push(...generateSchemaSql(context));

  downLines.push('-- Down Migration');
  downLines.push(`-- Created: ${new Date().toISOString()}`);
  downLines.push('');

  // Drop tables in reverse order
  for (const entity of [...context.entities].reverse()) {
    downLines.push(`DROP TABLE IF EXISTS "${entity.tableName}" CASCADE;`);
  }

  // Drop enums (PostgreSQL)
  if (context.options.provider === 'postgresql') {
    for (const enumDef of context.enums) {
      downLines.push(`DROP TYPE IF EXISTS "${enumDef.dbName}" CASCADE;`);
    }
  }

  return [
    {
      path: `migrations/${timestamp}_initial_up.sql`,
      content: upLines.join('\n'),
      type: 'sql',
    },
    {
      path: `migrations/${timestamp}_initial_down.sql`,
      content: downLines.join('\n'),
      type: 'sql',
    },
  ];
}

// ============================================
// Shared SQL Generation
// ============================================

function generateSchemaSql(context: GeneratorContext): string[] {
  const { entities, enums, options } = context;
  const provider = options.provider || 'postgresql';
  const lines: string[] = [];

  // Generate enums (PostgreSQL only)
  if (provider === 'postgresql' && enums.length > 0) {
    lines.push('-- Enum Types');
    for (const enumDef of enums) {
      const values = enumDef.values.map(v => `'${v}'`).join(', ');
      lines.push(`CREATE TYPE "${enumDef.dbName}" AS ENUM (${values});`);
    }
    lines.push('');
  }

  // Generate tables
  lines.push('-- Tables');
  for (const entity of entities) {
    lines.push(...generateTableSql(entity, context));
    lines.push('');
  }

  // Generate indexes
  lines.push('-- Indexes');
  for (const entity of entities) {
    for (const index of entity.indexes) {
      if (!index.unique) {
        const indexName = index.name || `idx_${entity.tableName}_${index.fields.join('_')}`;
        const columns = index.fields.map(f => `"${f}"`).join(', ');
        lines.push(`CREATE INDEX "${indexName}" ON "${entity.tableName}" (${columns});`);
      }
    }
  }

  return lines;
}

function generateTableSql(entity: NormalizedEntity, context: GeneratorContext): string[] {
  const lines: string[] = [];
  const provider = context.options.provider || 'postgresql';

  lines.push(`CREATE TABLE "${entity.tableName}" (`);

  const columnDefs: string[] = [];

  // Generate columns
  for (const field of entity.fields) {
    columnDefs.push(`  ${generateColumnSql(field, provider)}`);
  }

  // Add soft delete column if enabled
  if (context.options.softDelete) {
    columnDefs.push(`  "deleted_at" ${getTimestampType(provider)} NULL`);
  }

  // Add audit columns if enabled
  if (context.options.auditFields) {
    columnDefs.push('  "created_by" VARCHAR(255) NULL');
    columnDefs.push('  "updated_by" VARCHAR(255) NULL');
  }

  // Primary key constraint
  const pkFields = entity.fields.filter(f => f.primaryKey);
  if (pkFields.length > 0) {
    const pkColumns = pkFields.map(f => `"${f.columnName}"`).join(', ');
    columnDefs.push(`  PRIMARY KEY (${pkColumns})`);
  }

  // Unique constraints
  for (const unique of entity.uniqueConstraints) {
    const columns = unique.fields.map(f => `"${f}"`).join(', ');
    const constraintName = unique.name || `${entity.tableName}_${unique.fields.join('_')}_key`;
    columnDefs.push(`  CONSTRAINT "${constraintName}" UNIQUE (${columns})`);
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(');');

  return lines;
}

function generateColumnSql(field: NormalizedField, provider: string): string {
  const parts: string[] = [];

  parts.push(`"${field.columnName}"`);
  parts.push(getSqlType(field, provider));

  if (!field.nullable && !field.primaryKey) {
    parts.push('NOT NULL');
  }

  if (field.unique && !field.primaryKey) {
    parts.push('UNIQUE');
  }

  if (field.defaultValue && !field.primaryKey) {
    const defaultSql = formatDefaultSql(field.defaultValue, provider);
    if (defaultSql) {
      parts.push(`DEFAULT ${defaultSql}`);
    }
  }

  // Auto-generate for primary keys
  if (field.primaryKey && field.autoGenerate) {
    if (field.type.scalarType === 'UUID' && provider === 'postgresql') {
      parts.push('DEFAULT gen_random_uuid()');
    }
  }

  return parts.join(' ');
}

function getSqlType(field: NormalizedField, provider: string): string {
  // Handle enums
  if (field.type.kind === 'enum') {
    if (provider === 'postgresql') {
      return `"${field.type.enumName?.toLowerCase() || field.type.name.toLowerCase()}"`;
    }
    return 'VARCHAR(50)';
  }

  const scalarType = field.type.scalarType || 'String';

  // Handle auto-increment
  if (field.primaryKey && field.autoGenerate && scalarType === 'Int') {
    return provider === 'postgresql' ? 'SERIAL' : 'INT AUTO_INCREMENT';
  }

  const mappings: Record<string, Record<string, string>> = {
    postgresql: {
      String: getVarcharSql(field),
      Int: 'INTEGER',
      Float: 'REAL',
      Boolean: 'BOOLEAN',
      DateTime: 'TIMESTAMP',
      UUID: 'UUID',
      BigInt: 'BIGINT',
      Decimal: getDecimalSql(field),
      Json: 'JSONB',
      Bytes: 'BYTEA',
    },
    mysql: {
      String: getVarcharSql(field),
      Int: 'INT',
      Float: 'FLOAT',
      Boolean: 'TINYINT(1)',
      DateTime: 'DATETIME',
      UUID: 'VARCHAR(36)',
      BigInt: 'BIGINT',
      Decimal: getDecimalSql(field),
      Json: 'JSON',
      Bytes: 'BLOB',
    },
    sqlite: {
      String: 'TEXT',
      Int: 'INTEGER',
      Float: 'REAL',
      Boolean: 'INTEGER',
      DateTime: 'TEXT',
      UUID: 'TEXT',
      BigInt: 'INTEGER',
      Decimal: 'REAL',
      Json: 'TEXT',
      Bytes: 'BLOB',
    },
  };

  return mappings[provider]?.[scalarType] || 'TEXT';
}

function getVarcharSql(field: NormalizedField): string {
  const length = field.constraints.maxLength || 255;
  return `VARCHAR(${length})`;
}

function getDecimalSql(field: NormalizedField): string {
  const precision = field.constraints.precision || 10;
  const scale = field.constraints.scale || 2;
  return `DECIMAL(${precision}, ${scale})`;
}

function getTimestampType(provider: string): string {
  return provider === 'postgresql' ? 'TIMESTAMP' : provider === 'mysql' ? 'DATETIME' : 'TEXT';
}

function formatDefaultSql(defaultValue: import('./types.js').DefaultValue, provider: string): string | null {
  switch (defaultValue.kind) {
    case 'literal':
      if (typeof defaultValue.value === 'string') {
        return `'${defaultValue.value}'`;
      } else if (typeof defaultValue.value === 'boolean') {
        return provider === 'postgresql' ? (defaultValue.value ? 'TRUE' : 'FALSE') : (defaultValue.value ? '1' : '0');
      }
      return String(defaultValue.value);

    case 'function':
      switch (defaultValue.function) {
        case 'now':
          return 'CURRENT_TIMESTAMP';
        case 'uuid':
          return provider === 'postgresql' ? 'gen_random_uuid()' : null;
        default:
          return null;
      }

    default:
      return null;
  }
}

function generateTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

function escapeSql(sql: string): string {
  return sql.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}
