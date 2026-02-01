/**
 * @intentos/migrations
 * 
 * Generate database migrations from ISL entity changes with safety checks and rollback support.
 * 
 * @example
 * ```typescript
 * import { diffDomains, generatePrismaMigration, checkMigrationSafety } from '@intentos/migrations';
 * 
 * // Compare two domain versions
 * const diff = diffDomains(oldDomain, newDomain);
 * 
 * // Check safety before migrating
 * const safety = checkMigrationSafety(diff);
 * if (!safety.safe) {
 *   console.warn('Migration has critical issues:', safety.issues);
 * }
 * 
 * // Generate migration for your preferred ORM
 * const migration = generatePrismaMigration(diff, { dialect: 'postgresql' });
 * console.log(migration.up);
 * console.log(migration.down);
 * ```
 */

// Types
export type {
  // Diff types
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  TypeAliasDiff,
  DiffStats,
  SerializedValue,
  
  // Safety types
  SafetyReport,
  SafetyIssue,
  SafetyIssueType,
  MigrationStrategy,
  MigrationStep,
  
  // Generator types
  MigrationOutput,
  MigrationMetadata,
  GeneratorType,
  GeneratorOptions,
  SqlDialect,
  NamingConvention,
  
  // Rollback types
  RollbackPlan,
  RollbackStep,
  DataPreservationStrategy,
  
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  
  // Template types
  MigrationTemplate,
  TemplateVariable,
} from './types.js';

// Differ
export {
  diffDomains,
  emptyDiff,
  isDiffEmpty,
  getDiffSummary,
} from './differ.js';

// Generators
export {
  generateSqlMigration,
  generatePrismaMigration,
  generatePrismaModel,
  generateDrizzleMigration,
  generateDrizzleSchema,
  generateKnexMigration,
  generateKnexSeed,
} from './generators/index.js';

// Validators
export {
  checkMigrationSafety,
  validateMigration,
  getSafetySummary,
  generateRollbackPlan,
  generateRollback,
  canRollback,
  getRollbackWarnings,
  generateDataPreservationSql,
} from './validators/index.js';

// Utilities
export {
  // Naming conventions
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  applyNamingConvention,
  defaultNamingConvention,
  
  // Type utilities
  serializeType,
  getBaseTypeName,
  isPrimitiveType,
  islTypeToSql,
  isTypeSafeChange,
  
  // Expression utilities
  serializeExpression,
  expressionToString,
  serializeDefault,
  escapeString,
  
  // Constraint utilities
  serializeConstraints,
  serializeAnnotations,
  hasAnnotation,
  getAnnotationValue,
  
  // SQL utilities
  quoteIdentifier,
  qualifiedTableName,
  generateIndexName,
  generateForeignKeyName,
  generateConstraintName,
  
  // Migration name utilities
  generateTimestamp,
  generateMigrationName,
  
  // Array utilities
  arraysEqual,
  getAdded,
  getRemoved,
} from './utils.js';

/**
 * Create a migration generator with preset options
 */
export function createMigrationGenerator(defaultOptions: Partial<import('./types.js').GeneratorOptions>) {
  return {
    /**
     * Generate SQL migration
     */
    sql(diff: import('./types.js').DomainDiff) {
      const { generateSqlMigration } = require('./generators/sql.js');
      return generateSqlMigration(diff, defaultOptions);
    },
    
    /**
     * Generate Prisma migration
     */
    prisma(diff: import('./types.js').DomainDiff) {
      const { generatePrismaMigration } = require('./generators/prisma.js');
      return generatePrismaMigration(diff, defaultOptions);
    },
    
    /**
     * Generate Drizzle migration
     */
    drizzle(diff: import('./types.js').DomainDiff) {
      const { generateDrizzleMigration } = require('./generators/drizzle.js');
      return generateDrizzleMigration(diff, defaultOptions);
    },
    
    /**
     * Generate Knex migration
     */
    knex(diff: import('./types.js').DomainDiff) {
      const { generateKnexMigration } = require('./generators/knex.js');
      return generateKnexMigration(diff, defaultOptions);
    },
  };
}

/**
 * Quick migration generation from ISL domains
 */
export async function migrate(
  oldDomain: import('@intentos/isl-core').DomainDeclaration,
  newDomain: import('@intentos/isl-core').DomainDeclaration,
  options: {
    generator?: import('./types.js').GeneratorType;
    options?: Partial<import('./types.js').GeneratorOptions>;
    validateSafety?: boolean;
  } = {}
): Promise<import('./types.js').MigrationOutput> {
  const { diffDomains } = await import('./differ.js');
  const { checkMigrationSafety } = await import('./validators/safe.js');
  
  const diff = diffDomains(oldDomain, newDomain);
  
  if (options.validateSafety !== false) {
    const safety = checkMigrationSafety(diff);
    if (!safety.safe) {
      throw new Error(
        `Migration has ${safety.issues.filter(i => i.severity === 'critical').length} critical issue(s). ` +
        `Set validateSafety: false to proceed anyway.`
      );
    }
  }
  
  const generator = options.generator || 'sql';
  const generatorOptions = options.options || {};
  
  switch (generator) {
    case 'prisma': {
      const { generatePrismaMigration } = await import('./generators/prisma.js');
      return generatePrismaMigration(diff, generatorOptions);
    }
    case 'drizzle': {
      const { generateDrizzleMigration } = await import('./generators/drizzle.js');
      return generateDrizzleMigration(diff, generatorOptions);
    }
    case 'knex': {
      const { generateKnexMigration } = await import('./generators/knex.js');
      return generateKnexMigration(diff, generatorOptions);
    }
    case 'sql':
    default: {
      const { generateSqlMigration } = await import('./generators/sql.js');
      return generateSqlMigration(diff, generatorOptions);
    }
  }
}
