/**
 * @intentos/multi-tenant
 * 
 * Multi-tenancy support module for ISL domains.
 * 
 * @example
 * ```typescript
 * import { Tenant, withTenant, TenantContext } from '@intentos/multi-tenant';
 * 
 * // Execute code in tenant context
 * await withTenant(tenant, async () => {
 *   const currentTenant = TenantContext.getTenant();
 *   // All database queries are automatically filtered by tenant
 *   const users = await UserRepository.findMany();
 * });
 * ```
 */

// Core
export {
  TenantManager,
  InMemoryTenantRepository,
  TenantError,
  isValidSlug,
  generateSlug,
  DEFAULT_PLAN_LIMITS,
  type Tenant,
  type TenantLimits,
  type TenantSettings,
  type TenantRepository,
  type CreateTenantInput,
  type UpdateTenantInput,
  type PlanType,
  type TenantStatus,
  type IsolationStrategy,
  type TenantErrorCode,
} from './tenant.js';

// Context
export {
  TenantContext,
  NoTenantContextError,
  withTenant,
  withTenantContext,
  requireTenantContext,
  tenantKey,
  type TenantContextData,
  type ContextOptions,
} from './context.js';

// Middleware
export {
  createTenantMiddleware,
  createTenantHandler,
  extractTenantId,
  getTenantFromRequest,
  InMemoryTenantCache,
  type TenantMiddlewareOptions,
  type TenantExtractionStrategy,
  type TenantCache,
  type IncomingRequest,
} from './middleware.js';

// Isolation Strategies
export {
  // Row-Level Security
  createRowLevelSecurityExtension,
  createQueryMiddleware,
  tenantWhere,
  tenantData,
  validateTenantOwnership,
  assertTenantOwnership,
  generateRLSPolicy,
  TenantOwnershipError,
  type RowLevelSecurityConfig,
  type QueryMiddleware,
  
  // Schema-per-Tenant
  SchemaManager,
  createSchemaSwitcher,
  createSchemaHook,
  generateSchemasMigration,
  type SchemaConfig,
  type SchemaInfo,
  type SchemaSwitcher,
  
  // Database-per-Tenant
  DatabaseManager,
  ConnectionPool,
  generateProvisioningPlan,
  DatabaseNotFoundError,
  type DatabaseConfig,
  type TenantDatabaseInfo,
  type DatabasePoolConfig,
} from './isolation/index.js';

// Generators
export {
  generateTenantAwareISL,
  generateFullTenantAwareISL,
  transformEntity,
  transformBehavior,
  generateLimitCheck,
  generateTenantIsolationAnnotation,
  MigrationGenerator,
  formatMigration,
  getMigrationFilename,
  type MultiTenantConfig,
  type TenantAwareTransform,
  type MigrationConfig,
  type Migration,
} from './generator/index.js';

// Billing & Usage
export {
  UsageTracker,
  InMemoryUsageStorage,
  createUsageTracker,
  DEFAULT_USAGE_LIMITS,
  LimitEnforcer,
  QuotaManager,
  TenantRateLimiter,
  LimitExceededError,
  QuotaExceededError,
  RateLimitExceededError,
  type UsageMetric,
  type UsageSnapshot,
  type UsageTrackerConfig,
  type LimitConfig,
  type EnforcementResult,
  type RateLimitConfig,
  type RateLimitResult,
} from './billing/index.js';
