/**
 * Raw SQL Migration Generator
 * 
 * Generates raw SQL migrations from ISL domain diffs.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  GeneratorOptions,
  SqlDialect,
  MigrationOutput,
} from '../types.js';

import {
  toSnakeCase,
  islTypeToSql,
  serializeDefault,
  quoteIdentifier,
  qualifiedTableName,
  generateIndexName,
  generateConstraintName,
  generateMigrationName,
  applyNamingConvention,
  defaultNamingConvention,
} from '../utils.js';

import { checkMigrationSafety } from '../validators/safe.js';

/**
 * Default generator options
 */
const defaultOptions: GeneratorOptions = {
  dialect: 'postgresql',
  includeComments: true,
  includeSafetyWarnings: true,
  generateRollback: true,
  namingConvention: defaultNamingConvention,
};

/**
 * Generate SQL migration from domain diff
 */
export function generateSqlMigration(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): MigrationOutput {
  const opts = { ...defaultOptions, ...options };
  const safety = checkMigrationSafety(diff);
  
  const upStatements = generateUpMigration(diff, opts);
  const downStatements = opts.generateRollback 
    ? generateDownMigration(diff, opts) 
    : '-- Rollback not generated';
  
  return {
    name: generateMigrationName(getDiffDescription(diff)),
    timestamp: new Date(),
    up: upStatements,
    down: downStatements,
    breaking: diff.breaking,
    safety,
    metadata: {
      domain: diff.domain,
      fromVersion: diff.oldVersion,
      toVersion: diff.newVersion,
      generator: 'sql',
      tablesAffected: getAffectedTables(diff, opts),
      columnsAffected: getAffectedColumns(diff, opts),
    },
  };
}

/**
 * Generate up migration SQL
 */
function generateUpMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const statements: string[] = [];
  
  // Header comment
  if (opts.includeComments) {
    statements.push(`-- Migration: ${diff.domain}`);
    statements.push(`-- From: ${diff.oldVersion || 'initial'}`);
    statements.push(`-- To: ${diff.newVersion || 'current'}`);
    statements.push(`-- Generated: ${new Date().toISOString()}`);
    statements.push('');
  }
  
  // Process enums first (they may be referenced by tables)
  for (const enumDiff of diff.enums) {
    statements.push(generateEnumMigration(enumDiff, opts));
  }
  
  // Process entities
  for (const entityDiff of diff.entities) {
    const sql = generateEntityMigration(entityDiff, opts);
    if (sql) {
      statements.push(sql);
    }
  }
  
  return statements.filter(s => s.trim()).join('\n\n');
}

/**
 * Generate down migration SQL
 */
function generateDownMigration(diff: DomainDiff, opts: GeneratorOptions): string {
  const statements: string[] = [];
  
  if (opts.includeComments) {
    statements.push('-- Rollback Migration');
    statements.push(`-- WARNING: Some operations may cause data loss`);
    statements.push('');
  }
  
  // Reverse order: entities first, then enums
  for (const entityDiff of [...diff.entities].reverse()) {
    const sql = generateEntityRollback(entityDiff, opts);
    if (sql) {
      statements.push(sql);
    }
  }
  
  for (const enumDiff of [...diff.enums].reverse()) {
    statements.push(generateEnumRollback(enumDiff, opts));
  }
  
  return statements.filter(s => s.trim()).join('\n\n');
}

/**
 * Generate entity migration SQL
 */
function generateEntityMigration(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = getTableName(entityDiff.entity, opts);
  
  switch (entityDiff.type) {
    case 'added':
      return generateCreateTable(entityDiff, tableName, opts);
    
    case 'removed':
      return generateDropTable(entityDiff, tableName, opts);
    
    case 'modified':
      return generateAlterTable(entityDiff, tableName, opts);
  }
}

/**
 * Generate CREATE TABLE statement
 */
function generateCreateTable(
  entityDiff: EntityDiff, 
  tableName: string, 
  opts: GeneratorOptions
): string {
  const statements: string[] = [];
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  
  if (opts.includeComments) {
    statements.push(`-- Create table: ${entityDiff.entity}`);
  }
  
  const columns = entityDiff.changes!.map(change => {
    const colName = getColumnName(change.field, opts);
    const sqlType = islTypeToSql(change.newType!, opts.dialect, opts.typeMapping);
    const nullable = change.nullable ? '' : ' NOT NULL';
    const defaultVal = change.defaultValue 
      ? ` DEFAULT ${serializeDefault(change.defaultValue, opts.dialect)}`
      : '';
    
    return `  ${quoteIdentifier(colName, opts.dialect)} ${sqlType}${nullable}${defaultVal}`;
  });
  
  // Add primary key if 'id' field exists
  const hasIdField = entityDiff.changes!.some(c => c.field.toLowerCase() === 'id');
  if (hasIdField) {
    const idCol = getColumnName('id', opts);
    columns.push(`  CONSTRAINT ${generateConstraintName(tableName, 'pk', [idCol])} PRIMARY KEY (${quoteIdentifier(idCol, opts.dialect)})`);
  }
  
  statements.push(`CREATE TABLE ${quotedTable} (`);
  statements.push(columns.join(',\n'));
  statements.push(');');
  
  return statements.join('\n');
}

/**
 * Generate DROP TABLE statement
 */
function generateDropTable(
  entityDiff: EntityDiff, 
  tableName: string, 
  opts: GeneratorOptions
): string {
  const statements: string[] = [];
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  
  if (opts.includeSafetyWarnings) {
    statements.push(`-- WARNING: Dropping table ${entityDiff.entity} will cause data loss`);
  }
  
  statements.push(`DROP TABLE IF EXISTS ${quotedTable};`);
  
  return statements.join('\n');
}

/**
 * Generate ALTER TABLE statements
 */
function generateAlterTable(
  entityDiff: EntityDiff, 
  tableName: string, 
  opts: GeneratorOptions
): string {
  const statements: string[] = [];
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  
  if (opts.includeComments) {
    statements.push(`-- Modify table: ${entityDiff.entity}`);
  }
  
  for (const change of entityDiff.changes!) {
    const colName = getColumnName(change.field, opts);
    const quotedCol = quoteIdentifier(colName, opts.dialect);
    
    switch (change.type) {
      case 'added':
        statements.push(generateAddColumn(quotedTable, change, opts));
        break;
      
      case 'removed':
        if (opts.includeSafetyWarnings) {
          statements.push(`-- WARNING: Dropping column ${change.field} will cause data loss`);
        }
        statements.push(`ALTER TABLE ${quotedTable} DROP COLUMN ${quotedCol};`);
        break;
      
      case 'modified':
        statements.push(...generateModifyColumn(quotedTable, change, opts));
        break;
    }
  }
  
  return statements.join('\n');
}

/**
 * Generate ADD COLUMN statement
 */
function generateAddColumn(
  quotedTable: string, 
  change: FieldChange, 
  opts: GeneratorOptions
): string {
  const colName = getColumnName(change.field, opts);
  const quotedCol = quoteIdentifier(colName, opts.dialect);
  const sqlType = islTypeToSql(change.newType!, opts.dialect, opts.typeMapping);
  const nullable = change.nullable ? '' : ' NOT NULL';
  
  let defaultVal = '';
  if (change.defaultValue) {
    defaultVal = ` DEFAULT ${serializeDefault(change.defaultValue, opts.dialect)}`;
  } else if (!change.nullable) {
    // Add warning for non-nullable without default
    const warning = opts.includeSafetyWarnings 
      ? `-- WARNING: Adding non-nullable column without default may fail on existing rows\n` 
      : '';
    defaultVal = ' DEFAULT <TODO>'; // Placeholder
    return `${warning}ALTER TABLE ${quotedTable} ADD COLUMN ${quotedCol} ${sqlType}${nullable}${defaultVal};`;
  }
  
  return `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedCol} ${sqlType}${nullable}${defaultVal};`;
}

/**
 * Generate column modification statements
 */
function generateModifyColumn(
  quotedTable: string, 
  change: FieldChange, 
  opts: GeneratorOptions
): string[] {
  const statements: string[] = [];
  const colName = getColumnName(change.field, opts);
  const quotedCol = quoteIdentifier(colName, opts.dialect);
  
  // Type change
  if (change.oldType !== undefined && change.newType !== undefined && change.oldType !== change.newType) {
    if (opts.includeSafetyWarnings) {
      statements.push(`-- WARNING: Type change from ${change.oldType} to ${change.newType} may cause data loss`);
    }
    
    const newSqlType = islTypeToSql(change.newType, opts.dialect, opts.typeMapping);
    
    switch (opts.dialect) {
      case 'postgresql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} TYPE ${newSqlType};`);
        break;
      case 'mysql':
        statements.push(`ALTER TABLE ${quotedTable} MODIFY COLUMN ${quotedCol} ${newSqlType};`);
        break;
      case 'sqlite':
        statements.push(`-- SQLite does not support ALTER COLUMN TYPE directly`);
        statements.push(`-- Consider recreating the table or using a workaround`);
        break;
      case 'mssql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} ${newSqlType};`);
        break;
    }
  }
  
  // Nullable change
  if (change.oldNullable !== undefined && change.nullable !== undefined && change.oldNullable !== change.nullable) {
    if (!change.nullable && opts.includeSafetyWarnings) {
      statements.push(`-- WARNING: Making column non-nullable may fail if null values exist`);
    }
    
    const action = change.nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
    
    switch (opts.dialect) {
      case 'postgresql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} ${action};`);
        break;
      case 'mysql':
        const sqlType = islTypeToSql(change.newType || change.oldType!, opts.dialect, opts.typeMapping);
        const nullability = change.nullable ? 'NULL' : 'NOT NULL';
        statements.push(`ALTER TABLE ${quotedTable} MODIFY COLUMN ${quotedCol} ${sqlType} ${nullability};`);
        break;
      case 'sqlite':
        statements.push(`-- SQLite does not support ALTER COLUMN NULL directly`);
        break;
      case 'mssql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} ${action};`);
        break;
    }
  }
  
  // Default value change
  if (change.defaultValue !== undefined) {
    const defaultVal = serializeDefault(change.defaultValue, opts.dialect);
    
    switch (opts.dialect) {
      case 'postgresql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} SET DEFAULT ${defaultVal};`);
        break;
      case 'mysql':
        statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} SET DEFAULT ${defaultVal};`);
        break;
      case 'sqlite':
        statements.push(`-- SQLite does not support ALTER COLUMN DEFAULT directly`);
        break;
      case 'mssql':
        statements.push(`ALTER TABLE ${quotedTable} ADD CONSTRAINT df_${toSnakeCase(change.field)} DEFAULT ${defaultVal} FOR ${quotedCol};`);
        break;
    }
  }
  
  return statements;
}

/**
 * Generate enum migration SQL
 */
function generateEnumMigration(enumDiff: EnumDiff, opts: GeneratorOptions): string {
  const enumName = getTableName(enumDiff.enum, opts);
  const quotedEnum = quoteIdentifier(enumName, opts.dialect);
  
  switch (enumDiff.type) {
    case 'added':
      if (opts.dialect === 'postgresql') {
        const variants = enumDiff.addedVariants!.map(v => `'${v}'`).join(', ');
        return `CREATE TYPE ${quotedEnum} AS ENUM (${variants});`;
      }
      return `-- Enum ${enumDiff.enum}: Use CHECK constraints or reference table for non-PostgreSQL`;
    
    case 'removed':
      if (opts.dialect === 'postgresql') {
        return `DROP TYPE IF EXISTS ${quotedEnum};`;
      }
      return `-- Enum ${enumDiff.enum} removed`;
    
    case 'modified':
      const statements: string[] = [];
      if (opts.dialect === 'postgresql') {
        for (const variant of enumDiff.addedVariants || []) {
          statements.push(`ALTER TYPE ${quotedEnum} ADD VALUE '${variant}';`);
        }
        if (enumDiff.removedVariants && enumDiff.removedVariants.length > 0) {
          statements.push(`-- WARNING: PostgreSQL does not support removing enum values`);
          statements.push(`-- Consider recreating the type or using a migration strategy`);
        }
      }
      return statements.join('\n');
  }
}

/**
 * Generate entity rollback SQL
 */
function generateEntityRollback(entityDiff: EntityDiff, opts: GeneratorOptions): string {
  const tableName = getTableName(entityDiff.entity, opts);
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  
  switch (entityDiff.type) {
    case 'added':
      // Rollback: drop the newly created table
      return `DROP TABLE IF EXISTS ${quotedTable};`;
    
    case 'removed':
      // Rollback: would need original schema to recreate
      return `-- Cannot automatically rollback dropped table ${entityDiff.entity}\n-- Original schema required to recreate`;
    
    case 'modified':
      // Rollback: reverse the changes
      const statements: string[] = [];
      for (const change of [...entityDiff.changes!].reverse()) {
        const colName = getColumnName(change.field, opts);
        const quotedCol = quoteIdentifier(colName, opts.dialect);
        
        switch (change.type) {
          case 'added':
            statements.push(`ALTER TABLE ${quotedTable} DROP COLUMN ${quotedCol};`);
            break;
          
          case 'removed':
            if (change.oldType) {
              const sqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
              const nullable = change.oldNullable ? '' : ' NOT NULL';
              statements.push(`ALTER TABLE ${quotedTable} ADD COLUMN ${quotedCol} ${sqlType}${nullable};`);
            }
            break;
          
          case 'modified':
            // Reverse type change
            if (change.oldType && change.newType && change.oldType !== change.newType) {
              const oldSqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
              statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} TYPE ${oldSqlType};`);
            }
            // Reverse nullable change
            if (change.oldNullable !== undefined && change.nullable !== undefined) {
              const action = change.oldNullable ? 'DROP NOT NULL' : 'SET NOT NULL';
              statements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedCol} ${action};`);
            }
            break;
        }
      }
      return statements.join('\n');
  }
}

/**
 * Generate enum rollback SQL
 */
function generateEnumRollback(enumDiff: EnumDiff, opts: GeneratorOptions): string {
  const enumName = getTableName(enumDiff.enum, opts);
  const quotedEnum = quoteIdentifier(enumName, opts.dialect);
  
  switch (enumDiff.type) {
    case 'added':
      if (opts.dialect === 'postgresql') {
        return `DROP TYPE IF EXISTS ${quotedEnum};`;
      }
      return '';
    
    case 'removed':
      return `-- Cannot automatically rollback removed enum ${enumDiff.enum}`;
    
    case 'modified':
      return `-- Cannot automatically rollback enum modifications for ${enumDiff.enum}`;
  }
}

/**
 * Get table name with naming convention
 */
function getTableName(entityName: string, opts: GeneratorOptions): string {
  const convention = opts.namingConvention?.table || 'snake_case';
  const name = applyNamingConvention(entityName, convention);
  return opts.tablePrefix ? `${opts.tablePrefix}${name}` : name;
}

/**
 * Get column name with naming convention
 */
function getColumnName(fieldName: string, opts: GeneratorOptions): string {
  const convention = opts.namingConvention?.column || 'snake_case';
  return applyNamingConvention(fieldName, convention);
}

/**
 * Get description for diff
 */
function getDiffDescription(diff: DomainDiff): string {
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
  
  return parts.length > 0 ? parts.slice(0, 3).join('_') : 'migration';
}

/**
 * Get affected tables
 */
function getAffectedTables(diff: DomainDiff, opts: GeneratorOptions): string[] {
  return diff.entities.map(e => getTableName(e.entity, opts));
}

/**
 * Get affected columns
 */
function getAffectedColumns(diff: DomainDiff, opts: GeneratorOptions): string[] {
  const columns: string[] = [];
  
  for (const entity of diff.entities) {
    const tableName = getTableName(entity.entity, opts);
    if (entity.changes) {
      for (const change of entity.changes) {
        columns.push(`${tableName}.${getColumnName(change.field, opts)}`);
      }
    }
  }
  
  return columns;
}
