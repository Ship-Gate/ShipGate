/**
 * Generators
 */

export {
  generateTenantAwareISL,
  generateFullTenantAwareISL,
  transformEntity,
  transformBehavior,
  generateLimitCheck,
  generateTenantIsolationAnnotation,
  generateTenantContextAccess,
  type MultiTenantConfig,
  type TenantAwareTransform,
  type EntityTransform,
  type BehaviorTransform,
} from './isl.js';

export {
  MigrationGenerator,
  formatMigration,
  getMigrationFilename,
  type MigrationConfig,
  type Migration,
  type TableSchema,
  type ColumnSchema,
  type IndexSchema,
  type ForeignKeySchema,
} from './migrations.js';
