/**
 * Knex Migration Generator
 * 
 * Generates Knex.js-compatible JavaScript migrations from ISL domain diffs.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  GeneratorOptions,
  MigrationOutput,
  SqlDialect,
} from '../types.js';

import {
  toSnakeCase,
  toCamelCase,
  islTypeToSql,
  generateMigrationName,
  defaultNamingConvention,
} from '../utils.js';

import { checkMigrationSafety } from '../validators/safe.js';

/**
 * Default Knex generator options
 */
const defaultOptions: GeneratorOptions = {
  dialect: 'postgresql',
  includeComments: true,
  includeSafetyWarnings: true,
  generateRollback: true,
  namingConvention: defaultNamingConvention,
};

/**
 * Generate Knex migration from domain diff
 */
export function generateKnexMigration(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): MigrationOutput {
  const opts = { ...defaultOptions, ...options };
  const safety = checkMigrationSafety(diff);
  
  const upStatements = generateKnexUpMigration(diff, opts);
  const downStatements = opts.generateRollback 
    ? generateKnexDownMigration(diff, opts) 
    : '// Rollback not generated';
  
  return {
    name: generateMigrationName(getKnexDiffDescription(diff)),
    timestamp: new Date(),
    up: upStatements,
    down: downStatements,
    breaking: diff.breaking,
    safety,
    metadata: {
      domain: diff.domain,
      fromVersion: diff.oldVersion,
      toVersion: diff.newVersion,
      generator: 'knex',
      tablesAffected: diff.entities.map(e => toSnakeCase(e.entity)),
      columnsAffected: getAffectedColumns(diff),
    },
  };
}

/**
 * Generate Knex up migration
 */
function generateKnexUpMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const lines: string[] = [];
  
  // Migration header
  lines.push('/**');
  lines.push(` * Migration: ${diff.domain}`);
  lines.push(` * Generated: ${new Date().toISOString()}`);
  lines.push(' */');
  lines.push('');
  
  // Export up function
  lines.push('exports.up = async function(knex) {');
  
  // Process enums first (PostgreSQL only)
  if (opts.dialect === 'postgresql') {
    for (const enumDiff of diff.enums) {
      if (enumDiff.type === 'added') {
        lines.push(generateKnexCreateEnum(enumDiff, opts));
      }
    }
  }
  
  // Process entities
  for (const entityDiff of diff.entities) {
    switch (entityDiff.type) {
      case 'added':
        lines.push(generateKnexCreateTable(entityDiff, opts));
        break;
      case 'removed':
        lines.push(generateKnexDropTable(entityDiff, opts));
        break;
      case 'modified':
        lines.push(generateKnexAlterTable(entityDiff, opts));
        break;
    }
  }
  
  lines.push('};');
  
  return lines.join('\n');
}

/**
 * Generate Knex down migration
 */
function generateKnexDownMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push('/**');
  lines.push(' * Rollback Migration');
  lines.push(' */');
  lines.push('');
  lines.push('exports.down = async function(knex) {');
  
  // Reverse entity operations
  for (const entityDiff of [...diff.entities].reverse()) {
    switch (entityDiff.type) {
      case 'added':
        lines.push(`  await knex.schema.dropTableIfExists('${toSnakeCase(entityDiff.entity)}');`);
        break;
      case 'removed':
        lines.push(`  // Cannot automatically recreate dropped table "${entityDiff.entity}"`);
        break;
      case 'modified':
        lines.push(generateKnexReverseAlter(entityDiff, opts));
        break;
    }
  }
  
  // Reverse enum operations
  if (opts.dialect === 'postgresql') {
    for (const enumDiff of [...diff.enums].reverse()) {
      if (enumDiff.type === 'added') {
        lines.push(`  await knex.raw('DROP TYPE IF EXISTS "${toSnakeCase(enumDiff.enum)}"');`);
      }
    }
  }
  
  lines.push('};');
  
  return lines.join('\n');
}

/**
 * Generate Knex CREATE TABLE
 */
function generateKnexCreateTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeComments) {
    lines.push(`  // Create table: ${entityDiff.entity}`);
  }
  
  lines.push(`  await knex.schema.createTable('${tableName}', (table) => {`);
  
  for (const change of entityDiff.changes!) {
    const columnDef = generateKnexColumnDefinition(change, opts);
    lines.push(`    ${columnDef}`);
  }
  
  // Add timestamps if common fields exist
  const hasCreatedAt = entityDiff.changes!.some(c => c.field.toLowerCase() === 'createdat');
  const hasUpdatedAt = entityDiff.changes!.some(c => c.field.toLowerCase() === 'updatedat');
  if (!hasCreatedAt && !hasUpdatedAt) {
    lines.push('    table.timestamps(true, true);');
  }
  
  lines.push('  });');
  
  return lines.join('\n');
}

/**
 * Generate Knex column definition
 */
function generateKnexColumnDefinition(change: FieldChange, opts: GeneratorOptions): string {
  const colName = toSnakeCase(change.field);
  const knexType = getKnexColumnType(change.newType!, change.field);
  const modifiers = getKnexColumnModifiers(change, opts);
  
  // Special handling for primary key
  if (change.field.toLowerCase() === 'id') {
    if (change.newType === 'UUID') {
      return `table.uuid('${colName}').primary().defaultTo(knex.raw('gen_random_uuid()'));`;
    }
    return `table.increments('${colName}').primary();`;
  }
  
  return `table.${knexType}('${colName}')${modifiers};`;
}

/**
 * Get Knex column type
 */
function getKnexColumnType(islType: string, fieldName: string): string {
  // Check for common field name patterns
  if (fieldName.toLowerCase().endsWith('_id') || fieldName.toLowerCase() === 'id') {
    return 'integer';
  }
  
  const typeMap: Record<string, string> = {
    String: 'text',
    Int: 'integer',
    Float: 'float',
    Boolean: 'boolean',
    DateTime: 'timestamp',
    Date: 'date',
    Time: 'time',
    UUID: 'uuid',
    JSON: 'jsonb',
    Decimal: 'decimal',
    BigInt: 'bigInteger',
    Bytes: 'binary',
    Email: 'string',
    URL: 'text',
  };
  
  return typeMap[islType] || 'text';
}

/**
 * Get Knex column modifiers
 */
function getKnexColumnModifiers(change: FieldChange, opts: GeneratorOptions): string {
  const modifiers: string[] = [];
  
  // Not null
  if (!change.nullable) {
    modifiers.push('.notNullable()');
  } else {
    modifiers.push('.nullable()');
  }
  
  // Default value
  if (change.defaultValue) {
    modifiers.push(`.defaultTo(${serializeKnexDefault(change.defaultValue)})`);
  }
  
  return modifiers.join('');
}

/**
 * Serialize default value for Knex
 */
function serializeKnexDefault(value: { kind: string; value?: unknown }): string {
  switch (value.kind) {
    case 'string':
      return `'${value.value}'`;
    case 'number':
      return String(value.value);
    case 'boolean':
      return String(value.value);
    case 'null':
      return 'null';
    case 'expression':
      return `knex.raw('${value.value}')`;
    default:
      return 'null';
  }
}

/**
 * Generate Knex DROP TABLE
 */
function generateKnexDropTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeSafetyWarnings) {
    lines.push(`  // WARNING: Dropping table "${tableName}" will cause data loss`);
  }
  
  lines.push(`  await knex.schema.dropTableIfExists('${tableName}');`);
  
  return lines.join('\n');
}

/**
 * Generate Knex ALTER TABLE
 */
function generateKnexAlterTable(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  if (opts.includeComments) {
    lines.push(`  // Modify table: ${entityDiff.entity}`);
  }
  
  const hasChanges = entityDiff.changes && entityDiff.changes.length > 0;
  
  if (hasChanges) {
    lines.push(`  await knex.schema.alterTable('${tableName}', (table) => {`);
    
    for (const change of entityDiff.changes!) {
      const colName = toSnakeCase(change.field);
      
      switch (change.type) {
        case 'added':
          lines.push(generateKnexAddColumn(change, opts));
          break;
        
        case 'removed':
          if (opts.includeSafetyWarnings) {
            lines.push(`    // WARNING: Dropping column "${colName}" will cause data loss`);
          }
          lines.push(`    table.dropColumn('${colName}');`);
          break;
        
        case 'modified':
          lines.push(...generateKnexModifyColumn(change, opts));
          break;
      }
    }
    
    lines.push('  });');
  }
  
  return lines.join('\n');
}

/**
 * Generate Knex ADD COLUMN
 */
function generateKnexAddColumn(change: FieldChange, opts: GeneratorOptions): string {
  const colName = toSnakeCase(change.field);
  const knexType = getKnexColumnType(change.newType!, change.field);
  const modifiers = getKnexColumnModifiers(change, opts);
  
  if (!change.nullable && !change.defaultValue && opts.includeSafetyWarnings) {
    return [
      `    // WARNING: Adding required column without default may fail`,
      `    table.${knexType}('${colName}')${modifiers};`,
    ].join('\n');
  }
  
  return `    table.${knexType}('${colName}')${modifiers};`;
}

/**
 * Generate Knex column modification
 */
function generateKnexModifyColumn(change: FieldChange, opts: GeneratorOptions): string[] {
  const lines: string[] = [];
  const colName = toSnakeCase(change.field);
  
  // Type change
  if (change.oldType && change.newType && change.oldType !== change.newType) {
    if (opts.includeSafetyWarnings) {
      lines.push(`    // WARNING: Type change from ${change.oldType} to ${change.newType}`);
    }
    
    const knexType = getKnexColumnType(change.newType, change.field);
    lines.push(`    table.${knexType}('${colName}').alter();`);
  }
  
  // Nullable change
  if (change.oldNullable !== undefined && change.nullable !== undefined && change.oldNullable !== change.nullable) {
    if (!change.nullable && opts.includeSafetyWarnings) {
      lines.push(`    // WARNING: Making column non-nullable may fail if null values exist`);
    }
    
    const nullableMethod = change.nullable ? '.nullable()' : '.notNullable()';
    const knexType = getKnexColumnType(change.newType || change.oldType!, change.field);
    lines.push(`    table.${knexType}('${colName}')${nullableMethod}.alter();`);
  }
  
  // Default value change
  if (change.defaultValue) {
    const knexType = getKnexColumnType(change.newType || change.oldType!, change.field);
    const defaultVal = serializeKnexDefault(change.defaultValue);
    lines.push(`    table.${knexType}('${colName}').defaultTo(${defaultVal}).alter();`);
  }
  
  return lines;
}

/**
 * Generate Knex reverse ALTER
 */
function generateKnexReverseAlter(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  lines.push(`  await knex.schema.alterTable('${tableName}', (table) => {`);
  
  for (const change of [...entityDiff.changes!].reverse()) {
    const colName = toSnakeCase(change.field);
    
    switch (change.type) {
      case 'added':
        lines.push(`    table.dropColumn('${colName}');`);
        break;
      
      case 'removed':
        if (change.oldType) {
          const knexType = getKnexColumnType(change.oldType, change.field);
          const nullable = change.oldNullable ? '.nullable()' : '.notNullable()';
          lines.push(`    table.${knexType}('${colName}')${nullable};`);
        }
        break;
      
      case 'modified':
        if (change.oldType && change.newType && change.oldType !== change.newType) {
          const knexType = getKnexColumnType(change.oldType, change.field);
          lines.push(`    table.${knexType}('${colName}').alter();`);
        }
        if (change.oldNullable !== undefined && change.nullable !== undefined) {
          const nullableMethod = change.oldNullable ? '.nullable()' : '.notNullable()';
          const knexType = getKnexColumnType(change.oldType || change.newType!, change.field);
          lines.push(`    table.${knexType}('${colName}')${nullableMethod}.alter();`);
        }
        break;
    }
  }
  
  lines.push('  });');
  
  return lines.join('\n');
}

/**
 * Generate Knex CREATE ENUM (PostgreSQL only)
 */
function generateKnexCreateEnum(enumDiff: EnumDiff, opts: GeneratorOptions): string {
  const enumName = toSnakeCase(enumDiff.enum);
  const variants = enumDiff.addedVariants!.map(v => `'${v}'`).join(', ');
  
  return `  await knex.raw(\`CREATE TYPE "${enumName}" AS ENUM (${variants})\`);`;
}

/**
 * Get description for migration name
 */
function getKnexDiffDescription(diff: DomainDiff): string {
  const parts: string[] = [];
  
  for (const entity of diff.entities) {
    switch (entity.type) {
      case 'added':
        parts.push(`create_${toSnakeCase(entity.entity)}`);
        break;
      case 'removed':
        parts.push(`drop_${toSnakeCase(entity.entity)}`);
        break;
      case 'modified':
        parts.push(`alter_${toSnakeCase(entity.entity)}`);
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
 * Generate Knex seed file
 */
export function generateKnexSeed(
  entityDiff: EntityDiff,
  sampleData: Record<string, unknown>[] = []
): string {
  const tableName = toSnakeCase(entityDiff.entity);
  const lines: string[] = [];
  
  lines.push('/**');
  lines.push(` * Seed: ${entityDiff.entity}`);
  lines.push(' */');
  lines.push('');
  lines.push('exports.seed = async function(knex) {');
  lines.push(`  // Deletes ALL existing entries`);
  lines.push(`  await knex('${tableName}').del();`);
  lines.push('');
  
  if (sampleData.length > 0) {
    lines.push(`  // Insert seed entries`);
    lines.push(`  await knex('${tableName}').insert([`);
    for (const row of sampleData) {
      lines.push(`    ${JSON.stringify(row)},`);
    }
    lines.push('  ]);');
  }
  
  lines.push('};');
  
  return lines.join('\n');
}
