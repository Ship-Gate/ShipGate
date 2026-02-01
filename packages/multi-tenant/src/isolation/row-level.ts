/**
 * Row-Level Security
 * 
 * Automatic tenant filtering at the database query level.
 */

import { TenantContext, NoTenantContextError } from '../context.js';

// ============================================================================
// Types
// ============================================================================

export interface RowLevelSecurityConfig {
  tenantIdColumn: string;
  excludedModels?: string[];
  allowCrossTenant?: boolean;
  onViolation?: 'throw' | 'filter' | 'log';
}

export interface QueryContext {
  model: string;
  operation: string;
  args: Record<string, unknown>;
}

export type QueryMiddleware = (
  ctx: QueryContext,
  next: (args: Record<string, unknown>) => Promise<unknown>
) => Promise<unknown>;

// ============================================================================
// Row-Level Security Extension
// ============================================================================

/**
 * Create a Prisma-style extension for automatic tenant filtering
 */
export function createRowLevelSecurityExtension(config: RowLevelSecurityConfig) {
  const {
    tenantIdColumn = 'tenantId',
    excludedModels = [],
    allowCrossTenant = false,
    onViolation = 'throw',
  } = config;

  return {
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          // Skip excluded models
          if (excludedModels.includes(model)) {
            return query(args);
          }

          // Get current tenant
          const tenant = TenantContext.tryGetTenant();
          
          if (!tenant && !allowCrossTenant) {
            if (onViolation === 'throw') {
              throw new NoTenantContextError();
            } else if (onViolation === 'log') {
              console.warn(`[RLS] Query on ${model}.${operation} without tenant context`);
            }
            return query(args);
          }

          const tenantId = tenant?.id;

          // Apply tenant filtering based on operation
          const modifiedArgs = applyTenantFilter(
            operation,
            args,
            tenantIdColumn,
            tenantId
          );

          return query(modifiedArgs);
        },
      },
    },
  };
}

/**
 * Apply tenant filter to query args based on operation type
 */
function applyTenantFilter(
  operation: string,
  args: Record<string, unknown>,
  tenantIdColumn: string,
  tenantId?: string
): Record<string, unknown> {
  if (!tenantId) return args;

  const modifiedArgs = { ...args };

  // Read operations - add where clause
  if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
    modifiedArgs.where = {
      ...(modifiedArgs.where as Record<string, unknown> ?? {}),
      [tenantIdColumn]: tenantId,
    };
  }

  // Create operations - inject tenant ID
  if (['create'].includes(operation)) {
    modifiedArgs.data = {
      ...(modifiedArgs.data as Record<string, unknown> ?? {}),
      [tenantIdColumn]: tenantId,
    };
  }

  // CreateMany - inject tenant ID to all records
  if (['createMany'].includes(operation)) {
    const data = modifiedArgs.data;
    if (Array.isArray(data)) {
      modifiedArgs.data = data.map(d => ({
        ...d,
        [tenantIdColumn]: tenantId,
      }));
    }
  }

  // Update operations - add where clause
  if (['update', 'updateMany', 'upsert'].includes(operation)) {
    modifiedArgs.where = {
      ...(modifiedArgs.where as Record<string, unknown> ?? {}),
      [tenantIdColumn]: tenantId,
    };

    // Prevent changing tenant ID
    if (modifiedArgs.data && typeof modifiedArgs.data === 'object') {
      const data = modifiedArgs.data as Record<string, unknown>;
      if (tenantIdColumn in data) {
        delete data[tenantIdColumn];
      }
    }
  }

  // Delete operations - add where clause
  if (['delete', 'deleteMany'].includes(operation)) {
    modifiedArgs.where = {
      ...(modifiedArgs.where as Record<string, unknown> ?? {}),
      [tenantIdColumn]: tenantId,
    };
  }

  return modifiedArgs;
}

// ============================================================================
// Query Builder Helpers
// ============================================================================

/**
 * Build a tenant-scoped where clause
 */
export function tenantWhere<T extends Record<string, unknown>>(
  where: T,
  tenantIdColumn: string = 'tenantId'
): T & { [key: string]: string } {
  const tenantId = TenantContext.getTenantId();
  return {
    ...where,
    [tenantIdColumn]: tenantId,
  } as T & { [key: string]: string };
}

/**
 * Build tenant-scoped data for create
 */
export function tenantData<T extends Record<string, unknown>>(
  data: T,
  tenantIdColumn: string = 'tenantId'
): T & { [key: string]: string } {
  const tenantId = TenantContext.getTenantId();
  return {
    ...data,
    [tenantIdColumn]: tenantId,
  } as T & { [key: string]: string };
}

/**
 * Validate that a record belongs to current tenant
 */
export function validateTenantOwnership(
  record: Record<string, unknown>,
  tenantIdColumn: string = 'tenantId'
): boolean {
  const tenantId = TenantContext.tryGetTenant()?.id;
  if (!tenantId) return false;
  return record[tenantIdColumn] === tenantId;
}

/**
 * Assert that a record belongs to current tenant
 */
export function assertTenantOwnership(
  record: Record<string, unknown>,
  tenantIdColumn: string = 'tenantId'
): void {
  if (!validateTenantOwnership(record, tenantIdColumn)) {
    throw new TenantOwnershipError(record[tenantIdColumn] as string);
  }
}

// ============================================================================
// SQL Helpers
// ============================================================================

/**
 * Generate SQL WHERE clause for tenant isolation
 */
export function tenantSqlWhere(
  tableName: string,
  tenantIdColumn: string = 'tenant_id'
): string {
  const tenantId = TenantContext.getTenantId();
  return `${tableName}.${tenantIdColumn} = '${tenantId}'`;
}

/**
 * Generate PostgreSQL Row Level Security policy
 */
export function generateRLSPolicy(
  tableName: string,
  tenantIdColumn: string = 'tenant_id'
): string {
  return `
-- Enable RLS
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation
CREATE POLICY tenant_isolation ON ${tableName}
  USING (${tenantIdColumn} = current_setting('app.tenant_id')::uuid)
  WITH CHECK (${tenantIdColumn} = current_setting('app.tenant_id')::uuid);

-- Grant to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableName} TO app_user;
`;
}

// ============================================================================
// Errors
// ============================================================================

export class TenantOwnershipError extends Error {
  constructor(recordTenantId?: string) {
    const currentTenantId = TenantContext.tryGetTenant()?.id ?? 'unknown';
    super(
      `Record belongs to tenant "${recordTenantId ?? 'unknown'}" ` +
      `but current tenant is "${currentTenantId}"`
    );
    this.name = 'TenantOwnershipError';
  }
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create query middleware for any ORM
 */
export function createQueryMiddleware(config: RowLevelSecurityConfig): QueryMiddleware {
  const { tenantIdColumn = 'tenantId', excludedModels = [] } = config;

  return async (ctx, next) => {
    if (excludedModels.includes(ctx.model)) {
      return next(ctx.args);
    }

    const tenantId = TenantContext.tryGetTenant()?.id;
    if (!tenantId) {
      return next(ctx.args);
    }

    const modifiedArgs = applyTenantFilter(
      ctx.operation,
      ctx.args,
      tenantIdColumn,
      tenantId
    );

    return next(modifiedArgs);
  };
}
