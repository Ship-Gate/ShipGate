/**
 * Rollback Generator
 * 
 * Generates rollback plans and SQL for migrations.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  RollbackPlan,
  RollbackStep,
  DataPreservationStrategy,
  GeneratorOptions,
  SqlDialect,
} from '../types.js';

import {
  toSnakeCase,
  islTypeToSql,
  quoteIdentifier,
  qualifiedTableName,
  serializeDefault,
  defaultNamingConvention,
} from '../utils.js';

/**
 * Default rollback options
 */
const defaultOptions: GeneratorOptions = {
  dialect: 'postgresql',
  includeComments: true,
  includeSafetyWarnings: true,
  generateRollback: true,
  namingConvention: defaultNamingConvention,
};

/**
 * Generate rollback plan from domain diff
 */
export function generateRollbackPlan(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): RollbackPlan {
  const opts = { ...defaultOptions, ...options };
  const steps: RollbackStep[] = [];
  const dataLossWarnings: string[] = [];
  let possible = true;
  let order = 1;
  
  // Process entities in reverse order
  for (const entityDiff of [...diff.entities].reverse()) {
    const result = generateEntityRollback(entityDiff, order, opts);
    steps.push(...result.steps);
    dataLossWarnings.push(...result.warnings);
    if (!result.possible) possible = false;
    order += result.steps.length;
  }
  
  // Process enums in reverse order
  for (const enumDiff of [...diff.enums].reverse()) {
    const result = generateEnumRollback(enumDiff, order, opts);
    steps.push(...result.steps);
    dataLossWarnings.push(...result.warnings);
    if (!result.possible) possible = false;
    order += result.steps.length;
  }
  
  // Generate combined SQL
  const sql = generateRollbackSql(steps, opts);
  
  return {
    sql,
    possible,
    dataLossWarnings,
    steps,
  };
}

/**
 * Generate entity rollback
 */
function generateEntityRollback(
  entityDiff: EntityDiff,
  startOrder: number,
  opts: GeneratorOptions
): { steps: RollbackStep[]; warnings: string[]; possible: boolean } {
  const steps: RollbackStep[] = [];
  const warnings: string[] = [];
  let possible = true;
  let order = startOrder;
  
  const tableName = toSnakeCase(entityDiff.entity);
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  
  switch (entityDiff.type) {
    case 'added':
      // Rollback: drop the newly created table
      steps.push({
        order: order++,
        description: `Drop newly created table ${entityDiff.entity}`,
        sql: `DROP TABLE IF EXISTS ${quotedTable};`,
        dataPreservation: {
          type: 'backup_table',
          sql: `CREATE TABLE ${quotedTable}_rollback_backup AS SELECT * FROM ${quotedTable};`,
          restoreSql: `INSERT INTO ${quotedTable} SELECT * FROM ${quotedTable}_rollback_backup;`,
        },
      });
      warnings.push(`Dropping table ${entityDiff.entity} will lose any data added since migration`);
      break;
    
    case 'removed':
      // Rollback: cannot recreate without original schema
      possible = false;
      steps.push({
        order: order++,
        description: `Cannot automatically recreate dropped table ${entityDiff.entity}`,
        sql: `-- MANUAL INTERVENTION REQUIRED\n-- Original table schema needed to recreate ${entityDiff.entity}`,
      });
      warnings.push(`Cannot automatically restore dropped table ${entityDiff.entity} - original schema required`);
      break;
    
    case 'modified':
      // Rollback: reverse field changes
      if (entityDiff.changes) {
        for (const change of [...entityDiff.changes].reverse()) {
          const fieldResult = generateFieldRollback(tableName, change, order, opts);
          steps.push(...fieldResult.steps);
          warnings.push(...fieldResult.warnings);
          if (!fieldResult.possible) possible = false;
          order += fieldResult.steps.length;
        }
      }
      break;
  }
  
  return { steps, warnings, possible };
}

/**
 * Generate field rollback
 */
function generateFieldRollback(
  tableName: string,
  change: FieldChange,
  startOrder: number,
  opts: GeneratorOptions
): { steps: RollbackStep[]; warnings: string[]; possible: boolean } {
  const steps: RollbackStep[] = [];
  const warnings: string[] = [];
  let possible = true;
  let order = startOrder;
  
  const columnName = toSnakeCase(change.field);
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  const quotedColumn = quoteIdentifier(columnName, opts.dialect);
  
  switch (change.type) {
    case 'added':
      // Rollback: drop the newly added column
      steps.push({
        order: order++,
        description: `Drop column ${change.field} from ${tableName}`,
        sql: `ALTER TABLE ${quotedTable} DROP COLUMN ${quotedColumn};`,
        dataPreservation: {
          type: 'backup_table',
          sql: `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn}_backup ${islTypeToSql(change.newType!, opts.dialect)};\nUPDATE ${quotedTable} SET ${quotedColumn}_backup = ${quotedColumn};`,
        },
      });
      warnings.push(`Dropping column ${change.field} will lose any data added to it`);
      break;
    
    case 'removed':
      // Rollback: add back the removed column (without data)
      if (change.oldType) {
        const sqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
        const nullable = change.oldNullable ? '' : ' NOT NULL';
        
        steps.push({
          order: order++,
          description: `Restore column ${change.field} to ${tableName}`,
          sql: `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} ${sqlType}${nullable};`,
        });
        warnings.push(`Restored column ${change.field} will be empty - original data is lost`);
      } else {
        possible = false;
        steps.push({
          order: order++,
          description: `Cannot restore column ${change.field} - type information missing`,
          sql: `-- MANUAL INTERVENTION REQUIRED\n-- Original column type needed`,
        });
      }
      break;
    
    case 'modified':
      // Rollback: reverse the modifications
      const modSteps = generateFieldModificationRollback(
        tableName, 
        columnName, 
        change, 
        order, 
        opts
      );
      steps.push(...modSteps.steps);
      warnings.push(...modSteps.warnings);
      order += modSteps.steps.length;
      break;
  }
  
  return { steps, warnings, possible };
}

/**
 * Generate field modification rollback
 */
function generateFieldModificationRollback(
  tableName: string,
  columnName: string,
  change: FieldChange,
  startOrder: number,
  opts: GeneratorOptions
): { steps: RollbackStep[]; warnings: string[] } {
  const steps: RollbackStep[] = [];
  const warnings: string[] = [];
  let order = startOrder;
  
  const quotedTable = qualifiedTableName(tableName, opts.schema, opts.dialect);
  const quotedColumn = quoteIdentifier(columnName, opts.dialect);
  
  // Reverse type change
  if (change.oldType && change.newType && change.oldType !== change.newType) {
    const oldSqlType = islTypeToSql(change.oldType, opts.dialect, opts.typeMapping);
    
    steps.push({
      order: order++,
      description: `Revert type of ${change.field} from ${change.newType} to ${change.oldType}`,
      sql: generateTypeChangeSql(quotedTable, quotedColumn, oldSqlType, opts.dialect),
    });
    warnings.push(`Type reversion may cause data truncation or conversion errors`);
  }
  
  // Reverse nullable change
  if (change.oldNullable !== undefined && change.nullable !== undefined && change.oldNullable !== change.nullable) {
    const action = change.oldNullable ? 'DROP NOT NULL' : 'SET NOT NULL';
    
    steps.push({
      order: order++,
      description: `Revert nullability of ${change.field}`,
      sql: generateNullableChangeSql(quotedTable, quotedColumn, action, opts.dialect),
    });
    
    if (!change.oldNullable) {
      warnings.push(`Making ${change.field} non-nullable may fail if null values were added`);
    }
  }
  
  // Reverse default value change
  if (change.oldDefaultValue !== undefined) {
    const defaultVal = serializeDefault(change.oldDefaultValue, opts.dialect);
    
    steps.push({
      order: order++,
      description: `Revert default value of ${change.field}`,
      sql: `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} SET DEFAULT ${defaultVal};`,
    });
  }
  
  return { steps, warnings };
}

/**
 * Generate type change SQL based on dialect
 */
function generateTypeChangeSql(
  quotedTable: string,
  quotedColumn: string,
  newType: string,
  dialect: SqlDialect
): string {
  switch (dialect) {
    case 'postgresql':
      return `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} TYPE ${newType};`;
    case 'mysql':
      return `ALTER TABLE ${quotedTable} MODIFY COLUMN ${quotedColumn} ${newType};`;
    case 'sqlite':
      return `-- SQLite does not support ALTER COLUMN TYPE directly\n-- Consider recreating the table`;
    case 'mssql':
      return `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} ${newType};`;
  }
}

/**
 * Generate nullable change SQL based on dialect
 */
function generateNullableChangeSql(
  quotedTable: string,
  quotedColumn: string,
  action: string,
  dialect: SqlDialect
): string {
  switch (dialect) {
    case 'postgresql':
    case 'mssql':
      return `ALTER TABLE ${quotedTable} ALTER COLUMN ${quotedColumn} ${action};`;
    case 'mysql':
      return `-- MySQL requires full column definition for nullable change`;
    case 'sqlite':
      return `-- SQLite does not support ALTER COLUMN NULL directly`;
  }
}

/**
 * Generate enum rollback
 */
function generateEnumRollback(
  enumDiff: EnumDiff,
  startOrder: number,
  opts: GeneratorOptions
): { steps: RollbackStep[]; warnings: string[]; possible: boolean } {
  const steps: RollbackStep[] = [];
  const warnings: string[] = [];
  let possible = true;
  let order = startOrder;
  
  const enumName = toSnakeCase(enumDiff.enum);
  const quotedEnum = quoteIdentifier(enumName, opts.dialect);
  
  if (opts.dialect !== 'postgresql') {
    return { steps: [], warnings: [], possible: true };
  }
  
  switch (enumDiff.type) {
    case 'added':
      steps.push({
        order: order++,
        description: `Drop newly created enum ${enumDiff.enum}`,
        sql: `DROP TYPE IF EXISTS ${quotedEnum};`,
      });
      break;
    
    case 'removed':
      possible = false;
      steps.push({
        order: order++,
        description: `Cannot recreate dropped enum ${enumDiff.enum}`,
        sql: `-- MANUAL INTERVENTION REQUIRED\n-- Original enum values needed`,
      });
      warnings.push(`Cannot automatically restore dropped enum ${enumDiff.enum}`);
      break;
    
    case 'modified':
      if (enumDiff.addedVariants && enumDiff.addedVariants.length > 0) {
        possible = false;
        steps.push({
          order: order++,
          description: `Cannot remove enum values in PostgreSQL`,
          sql: `-- PostgreSQL does not support removing enum values\n-- Consider recreating the enum type`,
        });
        warnings.push(`Cannot remove enum values ${enumDiff.addedVariants.join(', ')} - PostgreSQL limitation`);
      }
      break;
  }
  
  return { steps, warnings, possible };
}

/**
 * Generate combined rollback SQL
 */
function generateRollbackSql(steps: RollbackStep[], opts: GeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push('-- Rollback Migration');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- WARNING: Review carefully before executing');
  lines.push('');
  
  // Transaction wrapper
  if (opts.dialect === 'postgresql' || opts.dialect === 'mssql') {
    lines.push('BEGIN;');
    lines.push('');
  }
  
  for (const step of steps) {
    lines.push(`-- Step ${step.order}: ${step.description}`);
    if (step.dataPreservation) {
      lines.push('-- Data preservation:');
      lines.push(`-- ${step.dataPreservation.sql?.replace(/\n/g, '\n-- ')}`);
    }
    lines.push(step.sql);
    lines.push('');
  }
  
  // Commit
  if (opts.dialect === 'postgresql' || opts.dialect === 'mssql') {
    lines.push('COMMIT;');
  }
  
  return lines.join('\n');
}

/**
 * Generate rollback from migration output
 */
export function generateRollback(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): string {
  const plan = generateRollbackPlan(diff, options);
  return plan.sql;
}

/**
 * Check if rollback is possible
 */
export function canRollback(diff: DomainDiff): boolean {
  // Cannot rollback if tables were dropped
  if (diff.entities.some(e => e.type === 'removed')) {
    return false;
  }
  
  // Cannot rollback if columns were dropped
  for (const entity of diff.entities) {
    if (entity.changes?.some(c => c.type === 'removed')) {
      return false;
    }
  }
  
  // Cannot rollback enum drops in PostgreSQL
  if (diff.enums.some(e => e.type === 'removed')) {
    return false;
  }
  
  return true;
}

/**
 * Get rollback warnings
 */
export function getRollbackWarnings(diff: DomainDiff): string[] {
  const warnings: string[] = [];
  
  for (const entity of diff.entities) {
    if (entity.type === 'added') {
      warnings.push(`Rollback will drop table ${entity.entity} and all its data`);
    }
    if (entity.type === 'removed') {
      warnings.push(`Cannot restore dropped table ${entity.entity} - data is permanently lost`);
    }
    if (entity.changes) {
      for (const change of entity.changes) {
        if (change.type === 'added') {
          warnings.push(`Rollback will drop column ${entity.entity}.${change.field} and its data`);
        }
        if (change.type === 'removed') {
          warnings.push(`Cannot restore column ${entity.entity}.${change.field} data`);
        }
      }
    }
  }
  
  return warnings;
}

/**
 * Generate data preservation SQL
 */
export function generateDataPreservationSql(
  diff: DomainDiff,
  options: Partial<GeneratorOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const lines: string[] = [];
  
  lines.push('-- Data Preservation Script');
  lines.push('-- Run BEFORE migration to preserve data');
  lines.push('');
  
  for (const entity of diff.entities) {
    if (entity.type === 'removed') {
      const tableName = toSnakeCase(entity.entity);
      lines.push(`-- Backup table ${entity.entity}`);
      lines.push(`CREATE TABLE "${tableName}_backup" AS SELECT * FROM "${tableName}";`);
      lines.push('');
    }
    
    if (entity.type === 'modified' && entity.changes) {
      const tableName = toSnakeCase(entity.entity);
      
      for (const change of entity.changes) {
        if (change.type === 'removed' && change.oldType) {
          const columnName = toSnakeCase(change.field);
          lines.push(`-- Backup column ${entity.entity}.${change.field}`);
          lines.push(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${columnName}_backup" ${islTypeToSql(change.oldType, opts.dialect)};`);
          lines.push(`UPDATE "${tableName}" SET "${columnName}_backup" = "${columnName}";`);
          lines.push('');
        }
      }
    }
  }
  
  return lines.join('\n');
}
