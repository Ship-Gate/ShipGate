/**
 * Prisma Migration Generator
 * 
 * Generates Prisma-compatible SQL migrations from ISL domain diffs.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  GeneratorOptions,
  MigrationOutput,
} from '../types.js';

import {
  toSnakeCase,
  islTypeToSql,
  serializeDefault,
  quoteIdentifier,
  generateMigrationName,
  applyNamingConvention,
  defaultNamingConvention,
} from '../utils.js';

import { checkMigrationSafety } from '../validators/safe.js';

/**
 * Default Prisma generator options
 */
const defaultOptions: GeneratorOptions = {
  dialect: 'postgresql',
  includeComments: true,
  includeSafetyWarnings: true,
  generateRollback: true,
  namingConvention: defaultNamingConvention,
};

/**
 * Generate Prisma migration from domain diff
 */
export function generatePrismaMigration(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): MigrationOutput {
  const opts = { ...defaultOptions, ...options };
  const safety = checkMigrationSafety(diff);
  
  const upStatements = generatePrismaUpMigration(diff, opts);
  const downStatements = opts.generateRollback 
    ? generatePrismaDownMigration(diff, opts) 
    : '-- Rollback not generated';
  
  return {
    name: generateMigrationName(getPrismaDiffDescription(diff)),
    timestamp: new Date(),
    up: upStatements,
    down: downStatements,
    breaking: diff.breaking,
    safety,
    metadata: {
      domain: diff.domain,
      fromVersion: diff.oldVersion,
      toVersion: diff.newVersion,
      generator: 'prisma',
      tablesAffected: diff.entities.map(e => toSnakeCase(e.entity)),
      columnsAffected: getAffectedColumns(diff),
    },
  };
}

/**
 * Generate Prisma up migration
 */
function generatePrismaUpMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const statements: string[] = [];
  
  // Prisma migration header
  statements.push('-- Prisma Migration');
  statements.push(`-- Migration ID: ${generateMigrationName(getPrismaDiffDescription(diff))}`);
  statements.push('');
  
  // Create enums first
  for (const enumDiff of diff.enums) {
    if (enumDiff.type === 'added') {
      statements.push(generatePrismaCreateEnum(enumDiff));
    }
  }
  
  // Process entity changes
  for (const entityDiff of diff.entities) {
    switch (entityDiff.type) {
      case 'added':
        statements.push(generatePrismaCreateTable(entityDiff, opts));
        break;
      case 'removed':
        statements.push(generatePrismaDropTable(entityDiff, opts));
        break;
      case 'modified':
        statements.push(generatePrismaAlterTable(entityDiff, opts));
        break;
    }
  }
  
  // Modify enums after tables (for adding values)
  for (const enumDiff of diff.enums) {
    if (enumDiff.type === 'modified' && enumDiff.addedVariants) {
      statements.push(generatePrismaModifyEnum(enumDiff));
    }
  }
  
  return statements.filter(s => s.trim()).join('\n\n');
}

/**
 * Generate Prisma down migration
 */
function generatePrismaDownMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const statements: string[] = [];
  
  statements.push('-- Rollback Migration');
  statements.push('');
  
  // Reverse entity operations
  for (const entityDiff of [...diff.entities].reverse()) {
    switch (entityDiff.type) {
      case 'added':
        statements.push(`-- DropTable\nDROP TABLE "${toSnakeCase(entityDiff.entity)}";`);
        break;
      case 'removed':
        statements.push(`-- Cannot recreate dropped table "${entityDiff.entity}" without original schema`);
        break;
      case 'modified':
        statements.push(generatePrismaReverseAlter(entityDiff, opts));
        break;
    }
  }
  
  // Reverse enum operations
  for (const enumDiff of [...diff.enums].reverse()) {
    if (enumDiff.type === 'added') {
      statements.push(`-- DropEnum\nDROP TYPE "${toSnakeCase(enumDiff.enum)}";`);
    }
  }
  
  return statements.filter(s => s.trim()).join('\n\n');
}

/**
 * Generate Prisma CREATE TABLE
 */
function generatePrismaCreateTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  lines.push('-- CreateTable');
  lines.push(`CREATE TABLE "${tableName}" (`);
  
  const columns: string[] = [];
  let hasPrimaryKey = false;
  
  for (const change of entityDiff.changes!) {
    const colName = toSnakeCase(change.field);
    const sqlType = getPrismaSqlType(change.newType!, opts);
    const nullable = change.nullable ? '' : ' NOT NULL';
    
    let defaultVal = '';
    if (change.defaultValue) {
      defaultVal = ` DEFAULT ${serializeDefault(change.defaultValue, opts.dialect)}`;
    }
    
    // Check if this is the primary key
    if (change.field.toLowerCase() === 'id') {
      hasPrimaryKey = true;
      columns.push(`    "${colName}" ${sqlType}${nullable}${defaultVal}`);
    } else {
      columns.push(`    "${colName}" ${sqlType}${nullable}${defaultVal}`);
    }
  }
  
  // Add primary key constraint
  if (hasPrimaryKey) {
    columns.push(`\n    CONSTRAINT "${tableName}_pkey" PRIMARY KEY ("id")`);
  }
  
  lines.push(columns.join(',\n'));
  lines.push(');');
  
  return lines.join('\n');
}

/**
 * Generate Prisma DROP TABLE
 */
function generatePrismaDropTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeSafetyWarnings) {
    lines.push(`-- WARNING: Dropping table "${tableName}" will cause data loss`);
  }
  
  lines.push('-- DropTable');
  lines.push(`DROP TABLE "${tableName}";`);
  
  return lines.join('\n');
}

/**
 * Generate Prisma ALTER TABLE
 */
function generatePrismaAlterTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  for (const change of entityDiff.changes!) {
    const colName = toSnakeCase(change.field);
    
    switch (change.type) {
      case 'added':
        lines.push(generatePrismaAddColumn(tableName, change, opts));
        break;
      
      case 'removed':
        if (opts.includeSafetyWarnings) {
          lines.push(`-- WARNING: Dropping column "${colName}" will cause data loss`);
        }
        lines.push('-- AlterTable');
        lines.push(`ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`);
        break;
      
      case 'modified':
        lines.push(...generatePrismaModifyColumn(tableName, change, opts));
        break;
    }
  }
  
  return lines.join('\n\n');
}

/**
 * Generate Prisma ADD COLUMN
 */
function generatePrismaAddColumn(
  tableName: string, 
  change: FieldChange, 
  opts: GeneratorOptions
): string {
  const colName = toSnakeCase(change.field);
  const sqlType = getPrismaSqlType(change.newType!, opts);
  const nullable = change.nullable ? '' : ' NOT NULL';
  
  let defaultVal = '';
  if (change.defaultValue) {
    defaultVal = ` DEFAULT ${serializeDefault(change.defaultValue, opts.dialect)}`;
  } else if (!change.nullable) {
    return [
      `-- WARNING: Adding required column without default`,
      '-- AlterTable',
      `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType}${nullable} DEFAULT <TODO>;`,
    ].join('\n');
  }
  
  return [
    '-- AlterTable',
    `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType}${nullable}${defaultVal};`,
  ].join('\n');
}

/**
 * Generate Prisma column modification
 */
function generatePrismaModifyColumn(
  tableName: string, 
  change: FieldChange, 
  opts: GeneratorOptions
): string[] {
  const lines: string[] = [];
  const colName = toSnakeCase(change.field);
  
  // Type change
  if (change.oldType && change.newType && change.oldType !== change.newType) {
    if (opts.includeSafetyWarnings) {
      lines.push(`-- WARNING: Type change from ${change.oldType} to ${change.newType}`);
    }
    
    const newSqlType = getPrismaSqlType(change.newType, opts);
    lines.push('-- AlterTable');
    lines.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET DATA TYPE ${newSqlType};`);
  }
  
  // Nullable change
  if (change.oldNullable !== undefined && change.nullable !== undefined && change.oldNullable !== change.nullable) {
    if (!change.nullable && opts.includeSafetyWarnings) {
      lines.push(`-- WARNING: Making column non-nullable may fail if null values exist`);
    }
    
    const action = change.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
    lines.push('-- AlterTable');
    lines.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" ${action};`);
  }
  
  // Default value change
  if (change.defaultValue) {
    const defaultVal = serializeDefault(change.defaultValue, opts.dialect);
    lines.push('-- AlterTable');
    lines.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET DEFAULT ${defaultVal};`);
  }
  
  return lines;
}

/**
 * Generate Prisma reverse ALTER
 */
function generatePrismaReverseAlter(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  for (const change of [...entityDiff.changes!].reverse()) {
    const colName = toSnakeCase(change.field);
    
    switch (change.type) {
      case 'added':
        lines.push(`-- AlterTable\nALTER TABLE "${tableName}" DROP COLUMN "${colName}";`);
        break;
      
      case 'removed':
        if (change.oldType) {
          const sqlType = getPrismaSqlType(change.oldType, opts);
          const nullable = change.oldNullable ? '' : ' NOT NULL';
          lines.push(`-- AlterTable\nALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType}${nullable};`);
        }
        break;
      
      case 'modified':
        if (change.oldType && change.newType && change.oldType !== change.newType) {
          const oldSqlType = getPrismaSqlType(change.oldType, opts);
          lines.push(`-- AlterTable\nALTER TABLE "${tableName}" ALTER COLUMN "${colName}" SET DATA TYPE ${oldSqlType};`);
        }
        if (change.oldNullable !== undefined && change.nullable !== undefined) {
          const action = change.oldNullable ? 'DROP NOT NULL' : 'SET NOT NULL';
          lines.push(`-- AlterTable\nALTER TABLE "${tableName}" ALTER COLUMN "${colName}" ${action};`);
        }
        break;
    }
  }
  
  return lines.join('\n\n');
}

/**
 * Generate Prisma CREATE TYPE (enum)
 */
function generatePrismaCreateEnum(enumDiff: EnumDiff): string {
  const enumName = toSnakeCase(enumDiff.enum);
  const variants = enumDiff.addedVariants!.map(v => `'${v}'`).join(', ');
  
  return [
    '-- CreateEnum',
    `CREATE TYPE "${enumName}" AS ENUM (${variants});`,
  ].join('\n');
}

/**
 * Generate Prisma enum modification
 */
function generatePrismaModifyEnum(enumDiff: EnumDiff): string {
  const enumName = toSnakeCase(enumDiff.enum);
  const lines: string[] = [];
  
  for (const variant of enumDiff.addedVariants || []) {
    lines.push('-- AlterEnum');
    lines.push(`ALTER TYPE "${enumName}" ADD VALUE '${variant}';`);
  }
  
  if (enumDiff.removedVariants && enumDiff.removedVariants.length > 0) {
    lines.push('-- WARNING: Removing enum values requires recreation of the type');
    lines.push(`-- Removed values: ${enumDiff.removedVariants.join(', ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Get Prisma-compatible SQL type
 */
function getPrismaSqlType(islType: string, opts: GeneratorOptions): string {
  // Prisma uses specific type names
  const prismaTypes: Record<string, string> = {
    String: 'TEXT',
    Int: 'INTEGER',
    Float: 'DOUBLE PRECISION',
    Boolean: 'BOOLEAN',
    DateTime: 'TIMESTAMP(3)',
    Date: 'DATE',
    Time: 'TIME',
    UUID: 'UUID',
    JSON: 'JSONB',
    Decimal: 'DECIMAL(65,30)',
    BigInt: 'BIGINT',
    Bytes: 'BYTEA',
  };
  
  return prismaTypes[islType] || islTypeToSql(islType, opts.dialect, opts.typeMapping);
}

/**
 * Get description for migration name
 */
function getPrismaDiffDescription(diff: DomainDiff): string {
  const parts: string[] = [];
  
  for (const entity of diff.entities) {
    switch (entity.type) {
      case 'added':
        parts.push(`add_${toSnakeCase(entity.entity)}`);
        break;
      case 'removed':
        parts.push(`remove_${toSnakeCase(entity.entity)}`);
        break;
      case 'modified':
        parts.push(`update_${toSnakeCase(entity.entity)}`);
        break;
    }
  }
  
  return parts.slice(0, 3).join('_') || 'migration';
}

/**
 * Get affected columns list
 */
function getAffectedColumns(diff: DomainDiff): string[] {
  const columns: string[] = [];
  
  for (const entity of diff.entities) {
    const tableName = toSnakeCase(entity.entity);
    if (entity.changes) {
      for (const change of entity.changes) {
        columns.push(`${tableName}.${toSnakeCase(change.field)}`);
      }
    }
  }
  
  return columns;
}

/**
 * Generate Prisma schema model from entity
 */
export function generatePrismaModel(entityDiff: EntityDiff): string {
  if (entityDiff.type !== 'added' || !entityDiff.changes) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push(`model ${entityDiff.entity} {`);
  
  for (const field of entityDiff.changes) {
    const prismaType = getPrismaSchemaType(field.newType!);
    const optional = field.nullable ? '?' : '';
    const defaultVal = field.defaultValue 
      ? ` @default(${serializePrismaDefault(field.defaultValue)})` 
      : '';
    const idAttr = field.field.toLowerCase() === 'id' ? ' @id @default(cuid())' : '';
    
    lines.push(`  ${field.field} ${prismaType}${optional}${defaultVal}${idAttr}`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Get Prisma schema type
 */
function getPrismaSchemaType(islType: string): string {
  const typeMap: Record<string, string> = {
    String: 'String',
    Int: 'Int',
    Float: 'Float',
    Boolean: 'Boolean',
    DateTime: 'DateTime',
    Date: 'DateTime',
    UUID: 'String',
    JSON: 'Json',
    Decimal: 'Decimal',
    BigInt: 'BigInt',
    Bytes: 'Bytes',
  };
  
  return typeMap[islType] || 'String';
}

/**
 * Serialize default value for Prisma schema
 */
function serializePrismaDefault(value: { kind: string; value?: unknown }): string {
  switch (value.kind) {
    case 'string':
      return `"${value.value}"`;
    case 'number':
      return String(value.value);
    case 'boolean':
      return String(value.value);
    default:
      return 'dbgenerated()';
  }
}
