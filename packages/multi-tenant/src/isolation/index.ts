/**
 * Isolation Strategies
 */

export {
  createRowLevelSecurityExtension,
  createQueryMiddleware,
  tenantWhere,
  tenantData,
  validateTenantOwnership,
  assertTenantOwnership,
  tenantSqlWhere,
  generateRLSPolicy,
  TenantOwnershipError,
  type RowLevelSecurityConfig,
  type QueryContext,
  type QueryMiddleware,
} from './row-level.js';

export {
  SchemaManager,
  createSchemaSwitcher,
  createSchemaHook,
  generateSchemasMigration,
  generateSchemasRollback,
  type SchemaConfig,
  type SchemaInfo,
  type SchemaSwitcher,
  type SchemaMigration,
} from './schema.js';

export {
  DatabaseManager,
  ConnectionPool,
  PooledConnection,
  generateProvisioningPlan,
  DatabaseNotFoundError,
  type DatabaseConfig,
  type TenantDatabaseInfo,
  type DatabasePoolConfig,
  type ProvisioningConfig,
} from './database.js';
