/**
 * Migration Safety Validator
 * 
 * Analyzes migrations for safety issues and potential data loss.
 */

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  SafetyReport,
  SafetyIssue,
  SafetyIssueType,
  MigrationStrategy,
  MigrationStep,
} from '../types.js';

import { toSnakeCase, isTypeSafeChange } from '../utils.js';

/**
 * Check migration safety and generate report
 */
export function checkMigrationSafety(diff: DomainDiff): SafetyReport {
  const issues: SafetyIssue[] = [];
  
  // Check entity-level issues
  for (const entityDiff of diff.entities) {
    issues.push(...checkEntitySafety(entityDiff));
  }
  
  // Check enum-level issues
  for (const enumDiff of diff.enums) {
    issues.push(...checkEnumSafety(enumDiff));
  }
  
  // Generate strategy based on issues
  const strategy = generateMigrationStrategy(diff, issues);
  
  return {
    safe: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    strategy,
  };
}

/**
 * Check entity safety
 */
function checkEntitySafety(entityDiff: EntityDiff): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const tableName = toSnakeCase(entityDiff.entity);
  
  // Dropped entity
  if (entityDiff.type === 'removed') {
    issues.push({
      severity: 'critical',
      type: 'table_dropped',
      entity: entityDiff.entity,
      message: `Dropping table "${tableName}" will cause permanent data loss`,
      mitigation: 'Consider renaming instead, or ensure data is backed up before migration',
      precheck: `SELECT COUNT(*) as row_count FROM "${tableName}";`,
      fixSql: `-- Backup before dropping:\nCREATE TABLE "${tableName}_backup" AS SELECT * FROM "${tableName}";`,
    });
    return issues;
  }
  
  // Check field changes
  if (entityDiff.changes) {
    for (const change of entityDiff.changes) {
      issues.push(...checkFieldSafety(entityDiff.entity, change));
    }
  }
  
  return issues;
}

/**
 * Check field safety
 */
function checkFieldSafety(entity: string, change: FieldChange): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const tableName = toSnakeCase(entity);
  const columnName = toSnakeCase(change.field);
  
  switch (change.type) {
    case 'removed':
      issues.push({
        severity: 'critical',
        type: 'column_dropped',
        entity,
        field: change.field,
        message: `Dropping column "${columnName}" from "${tableName}" will cause data loss`,
        mitigation: 'Migrate data to another column or backup before dropping',
        precheck: `SELECT COUNT(*) as non_null_count FROM "${tableName}" WHERE "${columnName}" IS NOT NULL;`,
        fixSql: `-- Backup column data:\nALTER TABLE "${tableName}" ADD COLUMN "${columnName}_backup" ${change.oldType};\nUPDATE "${tableName}" SET "${columnName}_backup" = "${columnName}";`,
      });
      break;
    
    case 'added':
      if (!change.nullable && !change.defaultValue) {
        issues.push({
          severity: 'warning',
          type: 'required_column_no_default',
          entity,
          field: change.field,
          message: `Adding required column "${columnName}" without default will fail if table has existing rows`,
          mitigation: 'Add default value, make nullable initially, or use expand-contract pattern',
          precheck: `SELECT COUNT(*) as row_count FROM "${tableName}";`,
          fixSql: `-- Option 1: Add with default\nALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${change.newType} NOT NULL DEFAULT <value>;\n\n-- Option 2: Add nullable then set values\nALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${change.newType};\nUPDATE "${tableName}" SET "${columnName}" = <value>;\nALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET NOT NULL;`,
        });
      }
      break;
    
    case 'modified':
      // Nullable to non-nullable
      if (change.oldNullable === true && change.nullable === false) {
        issues.push({
          severity: 'warning',
          type: 'nullable_to_required',
          entity,
          field: change.field,
          message: `Making "${columnName}" non-nullable may fail if null values exist`,
          mitigation: 'Update null values first or add default value',
          precheck: `SELECT COUNT(*) as null_count FROM "${tableName}" WHERE "${columnName}" IS NULL;`,
          fixSql: `-- Fix null values before making non-nullable:\nUPDATE "${tableName}" SET "${columnName}" = <default_value> WHERE "${columnName}" IS NULL;`,
        });
      }
      
      // Type change
      if (change.oldType && change.newType && change.oldType !== change.newType) {
        const isSafe = isTypeSafeChange(change.oldType, change.newType);
        
        if (!isSafe) {
          issues.push({
            severity: 'warning',
            type: 'type_change_data_loss',
            entity,
            field: change.field,
            message: `Type change from ${change.oldType} to ${change.newType} may cause data loss or conversion errors`,
            mitigation: 'Test conversion with sample data, add validation, consider using expand-contract pattern',
            precheck: `-- Check for values that won't convert:\nSELECT "${columnName}", COUNT(*) FROM "${tableName}" GROUP BY "${columnName}" LIMIT 100;`,
          });
        }
        
        // Check for type narrowing (e.g., removing precision)
        if (isTypeNarrowing(change.oldType, change.newType)) {
          issues.push({
            severity: 'warning',
            type: 'type_narrowing',
            entity,
            field: change.field,
            message: `Type narrowing from ${change.oldType} to ${change.newType} may truncate data`,
            mitigation: 'Verify all existing values fit in the new type',
            precheck: `-- Check for values that exceed new type limits:\nSELECT MAX(LENGTH("${columnName}"::text)) as max_length FROM "${tableName}";`,
          });
        }
      }
      
      // Constraint changes
      if (change.constraintsChanged && change.newConstraints) {
        for (const constraint of change.newConstraints) {
          if (constraint.includes('unique')) {
            issues.push({
              severity: 'warning',
              type: 'unique_constraint_added',
              entity,
              field: change.field,
              message: `Adding unique constraint to "${columnName}" may fail if duplicates exist`,
              mitigation: 'Check for and resolve duplicates before adding constraint',
              precheck: `SELECT "${columnName}", COUNT(*) as cnt FROM "${tableName}" GROUP BY "${columnName}" HAVING COUNT(*) > 1;`,
            });
          }
        }
      }
      break;
  }
  
  return issues;
}

/**
 * Check enum safety
 */
function checkEnumSafety(enumDiff: EnumDiff): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const enumName = toSnakeCase(enumDiff.enum);
  
  if (enumDiff.type === 'removed') {
    issues.push({
      severity: 'critical',
      type: 'enum_variant_removed',
      entity: enumDiff.enum,
      message: `Dropping enum type "${enumName}" will fail if columns still reference it`,
      mitigation: 'Update all columns using this enum type before dropping',
    });
  }
  
  if (enumDiff.removedVariants && enumDiff.removedVariants.length > 0) {
    issues.push({
      severity: 'critical',
      type: 'enum_variant_removed',
      entity: enumDiff.enum,
      message: `Removing enum variants [${enumDiff.removedVariants.join(', ')}] will fail if values exist in database`,
      mitigation: 'Migrate existing values to remaining variants first',
      precheck: `-- Check for usage of removed variants (example for each table using enum):\n-- SELECT * FROM table_name WHERE enum_column IN (${enumDiff.removedVariants.map(v => `'${v}'`).join(', ')});`,
    });
  }
  
  return issues;
}

/**
 * Check if type change is narrowing
 */
function isTypeNarrowing(oldType: string, newType: string): boolean {
  // Integer narrowing
  if (oldType === 'BigInt' && ['Int', 'SmallInt'].includes(newType)) return true;
  if (oldType === 'Int' && newType === 'SmallInt') return true;
  
  // Decimal narrowing
  const oldPrecision = extractPrecision(oldType);
  const newPrecision = extractPrecision(newType);
  if (oldPrecision && newPrecision && oldPrecision > newPrecision) return true;
  
  // String narrowing (VARCHAR with length)
  const oldLength = extractLength(oldType);
  const newLength = extractLength(newType);
  if (oldLength && newLength && oldLength > newLength) return true;
  
  return false;
}

/**
 * Extract precision from type string
 */
function extractPrecision(type: string): number | null {
  const match = type.match(/Decimal\((\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract length from type string
 */
function extractLength(type: string): number | null {
  const match = type.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Generate migration strategy
 */
function generateMigrationStrategy(
  diff: DomainDiff,
  issues: SafetyIssue[]
): MigrationStrategy {
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  
  // No issues - direct migration
  if (issues.length === 0) {
    return {
      approach: 'direct',
      steps: generateDirectSteps(diff),
      dataBackupRequired: false,
    };
  }
  
  // Critical issues - needs manual intervention
  if (criticalIssues.length > 0) {
    return {
      approach: 'manual',
      steps: generateManualSteps(diff, criticalIssues),
      dataBackupRequired: true,
    };
  }
  
  // Warning issues - use expand-contract
  if (warningIssues.length > 0) {
    return {
      approach: 'expand_contract',
      steps: generateExpandContractSteps(diff, warningIssues),
      dataBackupRequired: true,
    };
  }
  
  return {
    approach: 'direct',
    steps: [],
    dataBackupRequired: false,
  };
}

/**
 * Generate direct migration steps
 */
function generateDirectSteps(diff: DomainDiff): MigrationStep[] {
  const steps: MigrationStep[] = [];
  let order = 1;
  
  for (const entity of diff.entities) {
    switch (entity.type) {
      case 'added':
        steps.push({
          order: order++,
          description: `Create table ${entity.entity}`,
        });
        break;
      case 'removed':
        steps.push({
          order: order++,
          description: `Drop table ${entity.entity}`,
        });
        break;
      case 'modified':
        steps.push({
          order: order++,
          description: `Modify table ${entity.entity}`,
        });
        break;
    }
  }
  
  return steps;
}

/**
 * Generate manual migration steps
 */
function generateManualSteps(
  diff: DomainDiff,
  issues: SafetyIssue[]
): MigrationStep[] {
  const steps: MigrationStep[] = [];
  let order = 1;
  
  // Backup step
  steps.push({
    order: order++,
    description: 'Create database backup',
    manual: true,
  });
  
  // Address critical issues
  for (const issue of issues) {
    steps.push({
      order: order++,
      description: `Address: ${issue.message}`,
      manual: true,
      sql: issue.fixSql,
    });
  }
  
  // Run migration
  steps.push({
    order: order++,
    description: 'Run migration after resolving issues',
  });
  
  // Verify
  steps.push({
    order: order++,
    description: 'Verify data integrity after migration',
    manual: true,
  });
  
  return steps;
}

/**
 * Generate expand-contract migration steps
 */
function generateExpandContractSteps(
  diff: DomainDiff,
  issues: SafetyIssue[]
): MigrationStep[] {
  const steps: MigrationStep[] = [];
  let order = 1;
  
  // Expand phase
  steps.push({
    order: order++,
    description: 'EXPAND PHASE: Add new columns/tables without removing old ones',
  });
  
  // Data migration
  steps.push({
    order: order++,
    description: 'MIGRATE DATA: Copy/transform data to new structure',
    manual: true,
  });
  
  // Update application
  steps.push({
    order: order++,
    description: 'DEPLOY: Update application to use new structure',
    manual: true,
  });
  
  // Contract phase
  steps.push({
    order: order++,
    description: 'CONTRACT PHASE: Remove old columns/tables after verification',
  });
  
  return steps;
}

/**
 * Validate migration safety with options
 */
export function validateMigration(
  diff: DomainDiff,
  options: {
    allowBreaking?: boolean;
    allowDataLoss?: boolean;
    maxWarnings?: number;
  } = {}
): { valid: boolean; errors: string[] } {
  const report = checkMigrationSafety(diff);
  const errors: string[] = [];
  
  // Check breaking changes
  if (diff.breaking && !options.allowBreaking) {
    errors.push('Migration contains breaking changes. Set allowBreaking: true to proceed.');
  }
  
  // Check critical issues (data loss)
  const criticalIssues = report.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0 && !options.allowDataLoss) {
    errors.push(`Migration has ${criticalIssues.length} critical issue(s) that may cause data loss:`);
    for (const issue of criticalIssues) {
      errors.push(`  - ${issue.message}`);
    }
  }
  
  // Check warning threshold
  const warnings = report.issues.filter(i => i.severity === 'warning');
  if (options.maxWarnings !== undefined && warnings.length > options.maxWarnings) {
    errors.push(`Migration has ${warnings.length} warnings, exceeds max of ${options.maxWarnings}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get safety summary
 */
export function getSafetySummary(report: SafetyReport): string {
  const lines: string[] = [];
  
  if (report.safe) {
    lines.push('Migration is SAFE to apply.');
  } else {
    lines.push('Migration has CRITICAL ISSUES that must be addressed.');
  }
  
  const critical = report.issues.filter(i => i.severity === 'critical').length;
  const warnings = report.issues.filter(i => i.severity === 'warning').length;
  const info = report.issues.filter(i => i.severity === 'info').length;
  
  if (critical > 0) lines.push(`  Critical: ${critical}`);
  if (warnings > 0) lines.push(`  Warnings: ${warnings}`);
  if (info > 0) lines.push(`  Info: ${info}`);
  
  if (report.strategy) {
    lines.push(`\nRecommended approach: ${report.strategy.approach.toUpperCase()}`);
    if (report.strategy.dataBackupRequired) {
      lines.push('  Data backup: REQUIRED');
    }
  }
  
  return lines.join('\n');
}
