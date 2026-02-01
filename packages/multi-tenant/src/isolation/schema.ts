/**
 * Schema-Per-Tenant Isolation
 * 
 * Each tenant gets their own database schema.
 */

import { TenantContext } from '../context.js';
import type { Tenant } from '../tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface SchemaConfig {
  schemaPrefix: string;
  defaultSchema: string;
  publicSchema: string;
  connectionPool: ConnectionPoolConfig;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  acquireTimeout: number;
}

export interface SchemaInfo {
  name: string;
  tenantId: string;
  createdAt: Date;
  tables: string[];
  size?: number;
}

// ============================================================================
// Schema Manager
// ============================================================================

export class SchemaManager {
  private config: SchemaConfig;
  private schemas: Map<string, SchemaInfo> = new Map();

  constructor(config: Partial<SchemaConfig> = {}) {
    this.config = {
      schemaPrefix: config.schemaPrefix ?? 'tenant_',
      defaultSchema: config.defaultSchema ?? 'public',
      publicSchema: config.publicSchema ?? 'shared',
      connectionPool: config.connectionPool ?? {
        maxConnections: 20,
        idleTimeout: 30000,
        acquireTimeout: 10000,
      },
    };
  }

  /**
   * Get schema name for a tenant
   */
  getSchemaName(tenantId: string): string {
    return `${this.config.schemaPrefix}${tenantId.replace(/-/g, '_')}`;
  }

  /**
   * Get current tenant's schema name
   */
  getCurrentSchema(): string {
    const tenant = TenantContext.tryGetTenant();
    return tenant ? this.getSchemaName(tenant.id) : this.config.defaultSchema;
  }

  /**
   * Generate SQL to create tenant schema
   */
  generateCreateSchemaSQL(tenant: Tenant, tables: string[]): string {
    const schemaName = this.getSchemaName(tenant.id);
    const lines: string[] = [];

    // Create schema
    lines.push(`-- Create schema for tenant: ${tenant.name}`);
    lines.push(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
    lines.push('');

    // Set search path
    lines.push(`SET search_path TO ${schemaName};`);
    lines.push('');

    // Create tables (assuming they exist in public schema)
    for (const table of tables) {
      lines.push(`-- Clone table: ${table}`);
      lines.push(`CREATE TABLE ${schemaName}.${table} (LIKE ${this.config.publicSchema}.${table} INCLUDING ALL);`);
      lines.push('');
    }

    // Grant permissions
    lines.push('-- Grant permissions');
    lines.push(`GRANT USAGE ON SCHEMA ${schemaName} TO app_user;`);
    lines.push(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schemaName} TO app_user;`);
    lines.push(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schemaName} TO app_user;`);

    return lines.join('\n');
  }

  /**
   * Generate SQL to drop tenant schema
   */
  generateDropSchemaSQL(tenantId: string): string {
    const schemaName = this.getSchemaName(tenantId);
    return `DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`;
  }

  /**
   * Generate SQL to set schema for current session
   */
  generateSetSchemaSQL(tenantId: string): string {
    const schemaName = this.getSchemaName(tenantId);
    return `SET search_path TO ${schemaName}, ${this.config.publicSchema};`;
  }

  /**
   * Generate connection string with schema
   */
  getConnectionString(baseUrl: string, tenantId: string): string {
    const schemaName = this.getSchemaName(tenantId);
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schemaName);
    return url.toString();
  }

  /**
   * Register a schema
   */
  registerSchema(tenantId: string, tables: string[]): SchemaInfo {
    const info: SchemaInfo = {
      name: this.getSchemaName(tenantId),
      tenantId,
      createdAt: new Date(),
      tables,
    };
    this.schemas.set(tenantId, info);
    return info;
  }

  /**
   * Get schema info
   */
  getSchemaInfo(tenantId: string): SchemaInfo | undefined {
    return this.schemas.get(tenantId);
  }

  /**
   * List all schemas
   */
  listSchemas(): SchemaInfo[] {
    return Array.from(this.schemas.values());
  }
}

// ============================================================================
// Schema Switcher Middleware
// ============================================================================

export interface SchemaSwitcher {
  setSchema(tenantId: string): Promise<void>;
  resetSchema(): Promise<void>;
}

/**
 * Create a schema switcher for a database connection
 */
export function createSchemaSwitcher(
  executeSQL: (sql: string) => Promise<void>,
  config: Partial<SchemaConfig> = {}
): SchemaSwitcher {
  const manager = new SchemaManager(config);

  return {
    async setSchema(tenantId: string): Promise<void> {
      const sql = manager.generateSetSchemaSQL(tenantId);
      await executeSQL(sql);
    },

    async resetSchema(): Promise<void> {
      const defaultSchema = config.defaultSchema ?? 'public';
      await executeSQL(`SET search_path TO ${defaultSchema};`);
    },
  };
}

// ============================================================================
// Schema Migration Helper
// ============================================================================

export interface SchemaMigration {
  version: string;
  name: string;
  up: string;
  down: string;
}

/**
 * Generate migration SQL for all tenant schemas
 */
export function generateSchemasMigration(
  schemas: SchemaInfo[],
  migration: SchemaMigration
): string {
  const lines: string[] = [];

  lines.push(`-- Migration: ${migration.name} (${migration.version})`);
  lines.push(`-- Applied to ${schemas.length} tenant schemas`);
  lines.push('');

  for (const schema of schemas) {
    lines.push(`-- Schema: ${schema.name}`);
    lines.push(`SET search_path TO ${schema.name};`);
    lines.push(migration.up);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate rollback SQL for all tenant schemas
 */
export function generateSchemasRollback(
  schemas: SchemaInfo[],
  migration: SchemaMigration
): string {
  const lines: string[] = [];

  lines.push(`-- Rollback: ${migration.name} (${migration.version})`);
  lines.push('');

  for (const schema of schemas) {
    lines.push(`-- Schema: ${schema.name}`);
    lines.push(`SET search_path TO ${schema.name};`);
    lines.push(migration.down);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to run before each query to set schema
 */
export function createSchemaHook(switcher: SchemaSwitcher) {
  return async function schemaHook<T>(fn: () => Promise<T>): Promise<T> {
    const tenant = TenantContext.tryGetTenant();
    
    if (tenant) {
      await switcher.setSchema(tenant.id);
    }
    
    try {
      return await fn();
    } finally {
      if (tenant) {
        await switcher.resetSchema();
      }
    }
  };
}
