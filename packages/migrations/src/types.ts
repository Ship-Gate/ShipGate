/**
 * Migration Types
 * 
 * Type definitions for database migration generation from ISL changes.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  FieldDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  TypeExpression,
  Expression,
} from '@intentos/isl-core';

// ============================================
// Diff Types
// ============================================

/**
 * Represents the diff between two ISL domain versions
 */
export interface DomainDiff {
  /** Domain name */
  domain: string;
  /** Old version */
  oldVersion?: string;
  /** New version */
  newVersion?: string;
  /** Entity changes */
  entities: EntityDiff[];
  /** Enum changes */
  enums: EnumDiff[];
  /** Type alias changes */
  types: TypeAliasDiff[];
  /** Whether the diff contains breaking changes */
  breaking: boolean;
  /** Summary statistics */
  stats: DiffStats;
}

/**
 * Statistics about the diff
 */
export interface DiffStats {
  entitiesAdded: number;
  entitiesRemoved: number;
  entitiesModified: number;
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsModified: number;
  enumsAdded: number;
  enumsRemoved: number;
  enumsModified: number;
}

/**
 * Entity-level diff
 */
export interface EntityDiff {
  type: 'added' | 'removed' | 'modified';
  entity: string;
  changes?: FieldChange[];
  /** Original entity declaration (for removed/modified) */
  oldDeclaration?: EntityDeclaration;
  /** New entity declaration (for added/modified) */
  newDeclaration?: EntityDeclaration;
}

/**
 * Field-level change
 */
export interface FieldChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  oldType?: string;
  newType?: string;
  oldNullable?: boolean;
  nullable?: boolean;
  defaultValue?: SerializedValue;
  oldDefaultValue?: SerializedValue;
  constraintsChanged?: boolean;
  oldConstraints?: string[];
  newConstraints?: string[];
  annotationsChanged?: boolean;
  oldAnnotations?: string[];
  newAnnotations?: string[];
}

/**
 * Enum diff
 */
export interface EnumDiff {
  type: 'added' | 'removed' | 'modified';
  enum: string;
  addedVariants?: string[];
  removedVariants?: string[];
}

/**
 * Type alias diff
 */
export interface TypeAliasDiff {
  type: 'added' | 'removed' | 'modified';
  typeName: string;
  oldBaseType?: string;
  newBaseType?: string;
}

/**
 * Serialized value for defaults and expressions
 */
export type SerializedValue = 
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'expression'; value: string };

// ============================================
// Safety Types
// ============================================

/**
 * Migration safety report
 */
export interface SafetyReport {
  /** Whether the migration is safe to apply */
  safe: boolean;
  /** List of safety issues */
  issues: SafetyIssue[];
  /** Recommended migration strategy */
  strategy?: MigrationStrategy;
}

/**
 * Individual safety issue
 */
export interface SafetyIssue {
  severity: 'info' | 'warning' | 'critical';
  type: SafetyIssueType;
  entity: string;
  field?: string;
  message: string;
  mitigation: string;
  /** SQL to check before migration */
  precheck?: string;
  /** SQL to fix the issue */
  fixSql?: string;
}

/**
 * Types of safety issues
 */
export type SafetyIssueType =
  | 'table_dropped'
  | 'column_dropped'
  | 'nullable_to_required'
  | 'required_column_no_default'
  | 'type_narrowing'
  | 'type_change_data_loss'
  | 'constraint_added'
  | 'unique_constraint_added'
  | 'index_on_large_table'
  | 'enum_variant_removed'
  | 'foreign_key_added'
  | 'cascade_delete';

/**
 * Migration strategy recommendation
 */
export interface MigrationStrategy {
  approach: 'direct' | 'expand_contract' | 'blue_green' | 'manual';
  steps: MigrationStep[];
  estimatedDowntime?: string;
  dataBackupRequired: boolean;
}

/**
 * Individual migration step
 */
export interface MigrationStep {
  order: number;
  description: string;
  sql?: string;
  manual?: boolean;
  rollbackSql?: string;
}

// ============================================
// Generator Types
// ============================================

/**
 * Migration output
 */
export interface MigrationOutput {
  /** Migration name/identifier */
  name: string;
  /** Timestamp */
  timestamp: Date;
  /** Up migration SQL */
  up: string;
  /** Down migration SQL */
  down: string;
  /** Whether this is a breaking change */
  breaking: boolean;
  /** Safety report */
  safety: SafetyReport;
  /** Metadata */
  metadata: MigrationMetadata;
}

/**
 * Migration metadata
 */
export interface MigrationMetadata {
  /** Source domain */
  domain: string;
  /** From version */
  fromVersion?: string;
  /** To version */
  toVersion?: string;
  /** Generator used */
  generator: GeneratorType;
  /** Tables affected */
  tablesAffected: string[];
  /** Columns affected */
  columnsAffected: string[];
}

/**
 * Supported migration generators
 */
export type GeneratorType = 'prisma' | 'drizzle' | 'knex' | 'sql';

/**
 * Generator options
 */
export interface GeneratorOptions {
  /** Database dialect */
  dialect: SqlDialect;
  /** Schema name */
  schema?: string;
  /** Table prefix */
  tablePrefix?: string;
  /** Include comments */
  includeComments?: boolean;
  /** Include safety warnings */
  includeSafetyWarnings?: boolean;
  /** Generate rollback */
  generateRollback?: boolean;
  /** Custom type mappings */
  typeMapping?: Record<string, string>;
  /** Naming convention */
  namingConvention?: NamingConvention;
}

/**
 * SQL dialect
 */
export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';

/**
 * Naming convention
 */
export interface NamingConvention {
  table: 'snake_case' | 'camelCase' | 'PascalCase';
  column: 'snake_case' | 'camelCase' | 'PascalCase';
  index: 'snake_case' | 'camelCase' | 'PascalCase';
  foreignKey: 'snake_case' | 'camelCase' | 'PascalCase';
}

// ============================================
// Rollback Types
// ============================================

/**
 * Rollback plan
 */
export interface RollbackPlan {
  /** Rollback SQL */
  sql: string;
  /** Whether rollback is possible */
  possible: boolean;
  /** Data loss warnings */
  dataLossWarnings: string[];
  /** Steps to rollback */
  steps: RollbackStep[];
}

/**
 * Individual rollback step
 */
export interface RollbackStep {
  order: number;
  description: string;
  sql: string;
  dataPreservation?: DataPreservationStrategy;
}

/**
 * Data preservation strategy
 */
export interface DataPreservationStrategy {
  type: 'backup_table' | 'archive' | 'transform' | 'none';
  sql?: string;
  restoreSql?: string;
}

// ============================================
// Template Types
// ============================================

/**
 * Migration template
 */
export interface MigrationTemplate {
  name: string;
  description: string;
  generator: GeneratorType;
  template: string;
  variables: TemplateVariable[];
}

/**
 * Template variable
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'sql';
  required: boolean;
  default?: string;
}

// ============================================
// Validation Types
// ============================================

/**
 * Migration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  location?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}
