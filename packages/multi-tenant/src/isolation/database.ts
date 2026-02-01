/**
 * Database-Per-Tenant Isolation
 * 
 * Each tenant gets their own dedicated database.
 */

import { TenantContext } from '../context.js';
import type { Tenant, PlanType } from '../tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface TenantDatabaseInfo {
  tenantId: string;
  config: DatabaseConfig;
  status: 'active' | 'provisioning' | 'error' | 'archived';
  createdAt: Date;
  lastAccessedAt?: Date;
  sizeBytes?: number;
}

export interface DatabasePoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
  evictionRunIntervalMs: number;
}

// ============================================================================
// Database Manager
// ============================================================================

export class DatabaseManager {
  private databases: Map<string, TenantDatabaseInfo> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private defaultConfig: Partial<DatabaseConfig>;
  private poolConfig: DatabasePoolConfig;

  constructor(
    defaultConfig: Partial<DatabaseConfig> = {},
    poolConfig: Partial<DatabasePoolConfig> = {}
  ) {
    this.defaultConfig = defaultConfig;
    this.poolConfig = {
      minConnections: poolConfig.minConnections ?? 2,
      maxConnections: poolConfig.maxConnections ?? 10,
      idleTimeoutMs: poolConfig.idleTimeoutMs ?? 30000,
      acquireTimeoutMs: poolConfig.acquireTimeoutMs ?? 10000,
      evictionRunIntervalMs: poolConfig.evictionRunIntervalMs ?? 60000,
    };
  }

  /**
   * Generate database name for a tenant
   */
  getDatabaseName(tenant: Tenant): string {
    return `tenant_${tenant.slug.replace(/-/g, '_')}`;
  }

  /**
   * Register a tenant database
   */
  registerDatabase(tenant: Tenant, config: DatabaseConfig): TenantDatabaseInfo {
    const info: TenantDatabaseInfo = {
      tenantId: tenant.id,
      config,
      status: 'active',
      createdAt: new Date(),
    };
    this.databases.set(tenant.id, info);
    return info;
  }

  /**
   * Get database config for a tenant
   */
  getDatabase(tenantId: string): TenantDatabaseInfo | undefined {
    const info = this.databases.get(tenantId);
    if (info) {
      info.lastAccessedAt = new Date();
    }
    return info;
  }

  /**
   * Get database for current tenant
   */
  getCurrentDatabase(): TenantDatabaseInfo {
    const tenant = TenantContext.getTenant();
    const db = this.databases.get(tenant.id);
    if (!db) {
      throw new DatabaseNotFoundError(tenant.id);
    }
    return db;
  }

  /**
   * Get or create connection pool for tenant
   */
  getConnectionPool(tenantId: string): ConnectionPool {
    let pool = this.connectionPools.get(tenantId);
    
    if (!pool) {
      const dbInfo = this.databases.get(tenantId);
      if (!dbInfo) {
        throw new DatabaseNotFoundError(tenantId);
      }
      
      pool = new ConnectionPool(dbInfo.config, this.poolConfig);
      this.connectionPools.set(tenantId, pool);
    }
    
    return pool;
  }

  /**
   * Generate SQL to create tenant database
   */
  generateCreateDatabaseSQL(tenant: Tenant): string {
    const dbName = this.getDatabaseName(tenant);
    return `
-- Create database for tenant: ${tenant.name}
CREATE DATABASE ${dbName}
  WITH ENCODING 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE template0;

-- Create tenant user
CREATE USER ${dbName}_user WITH PASSWORD 'generated_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbName}_user;
`;
  }

  /**
   * Generate SQL to drop tenant database
   */
  generateDropDatabaseSQL(tenant: Tenant): string {
    const dbName = this.getDatabaseName(tenant);
    return `
-- Terminate connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '${dbName}';

-- Drop database
DROP DATABASE IF EXISTS ${dbName};

-- Drop user
DROP USER IF EXISTS ${dbName}_user;
`;
  }

  /**
   * Generate connection string for tenant
   */
  getConnectionString(tenant: Tenant): string {
    const dbInfo = this.databases.get(tenant.id);
    if (!dbInfo) {
      throw new DatabaseNotFoundError(tenant.id);
    }

    const { host, port, username, password, database, ssl } = dbInfo.config;
    const sslParam = ssl ? '?sslmode=require' : '';
    return `postgresql://${username}:${password}@${host}:${port}/${database}${sslParam}`;
  }

  /**
   * List all databases
   */
  listDatabases(): TenantDatabaseInfo[] {
    return Array.from(this.databases.values());
  }

  /**
   * Archive tenant database (soft delete)
   */
  archiveDatabase(tenantId: string): void {
    const db = this.databases.get(tenantId);
    if (db) {
      db.status = 'archived';
    }
    
    // Close connection pool
    const pool = this.connectionPools.get(tenantId);
    if (pool) {
      pool.close();
      this.connectionPools.delete(tenantId);
    }
  }

  /**
   * Close all connection pools
   */
  closeAll(): void {
    for (const pool of this.connectionPools.values()) {
      pool.close();
    }
    this.connectionPools.clear();
  }
}

// ============================================================================
// Connection Pool (Simple Implementation)
// ============================================================================

export class ConnectionPool {
  private connections: PooledConnection[] = [];
  private available: PooledConnection[] = [];
  private waiting: Array<(conn: PooledConnection) => void> = [];
  private config: DatabaseConfig;
  private poolConfig: DatabasePoolConfig;
  private closed = false;

  constructor(config: DatabaseConfig, poolConfig: DatabasePoolConfig) {
    this.config = config;
    this.poolConfig = poolConfig;
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection> {
    if (this.closed) {
      throw new Error('Connection pool is closed');
    }

    // Return available connection
    if (this.available.length > 0) {
      const conn = this.available.pop()!;
      conn.lastUsed = new Date();
      return conn;
    }

    // Create new connection if under limit
    if (this.connections.length < this.poolConfig.maxConnections) {
      const conn = await this.createConnection();
      this.connections.push(conn);
      return conn;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.indexOf(resolve);
        if (index !== -1) {
          this.waiting.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.poolConfig.acquireTimeoutMs);

      this.waiting.push((conn) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    if (this.closed) return;

    // Give to waiting requests first
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      connection.lastUsed = new Date();
      resolve(connection);
      return;
    }

    // Return to available pool
    this.available.push(connection);
  }

  /**
   * Execute a function with a connection
   */
  async withConnection<T>(fn: (conn: PooledConnection) => Promise<T>): Promise<T> {
    const conn = await this.acquire();
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }

  /**
   * Close the pool
   */
  close(): void {
    this.closed = true;
    for (const conn of this.connections) {
      conn.close();
    }
    this.connections = [];
    this.available = [];
    this.waiting = [];
  }

  /**
   * Get pool stats
   */
  getStats(): {
    total: number;
    available: number;
    waiting: number;
  } {
    return {
      total: this.connections.length,
      available: this.available.length,
      waiting: this.waiting.length,
    };
  }

  private async createConnection(): Promise<PooledConnection> {
    // In a real implementation, this would create an actual database connection
    return new PooledConnection(this.config);
  }
}

/**
 * Pooled connection wrapper
 */
export class PooledConnection {
  public lastUsed: Date = new Date();
  public createdAt: Date = new Date();
  private _closed = false;

  constructor(private config: DatabaseConfig) {}

  /**
   * Execute a query (placeholder - actual implementation depends on driver)
   */
  async query<T>(sql: string, params?: unknown[]): Promise<T> {
    if (this._closed) {
      throw new Error('Connection is closed');
    }
    // Placeholder - actual implementation would use database driver
    console.log(`[Query] ${sql}`, params);
    return {} as T;
  }

  /**
   * Close the connection
   */
  close(): void {
    this._closed = true;
  }

  /**
   * Check if connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (this._closed) return false;
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Errors
// ============================================================================

export class DatabaseNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Database not found for tenant: ${tenantId}`);
    this.name = 'DatabaseNotFoundError';
  }
}

// ============================================================================
// Provisioning Helper
// ============================================================================

export interface ProvisioningConfig {
  templateDatabase: string;
  defaultPlanConfigs: Record<PlanType, Partial<DatabaseConfig>>;
}

/**
 * Generate provisioning plan for a new tenant
 */
export function generateProvisioningPlan(
  tenant: Tenant,
  config: ProvisioningConfig
): {
  createSQL: string;
  databaseConfig: DatabaseConfig;
  estimatedTimeMs: number;
} {
  const planConfig = config.defaultPlanConfigs[tenant.plan] ?? {};
  
  const databaseConfig: DatabaseConfig = {
    host: planConfig.host ?? 'localhost',
    port: planConfig.port ?? 5432,
    username: `tenant_${tenant.slug}`,
    password: generateSecurePassword(),
    database: `tenant_${tenant.slug.replace(/-/g, '_')}`,
    ssl: planConfig.ssl ?? true,
    poolSize: planConfig.poolSize ?? (tenant.plan === 'ENTERPRISE' ? 20 : 5),
  };

  const createSQL = `
-- Provision database for: ${tenant.name} (${tenant.plan})
CREATE DATABASE ${databaseConfig.database} TEMPLATE ${config.templateDatabase};
CREATE USER ${databaseConfig.username} WITH PASSWORD '${databaseConfig.password}';
GRANT ALL PRIVILEGES ON DATABASE ${databaseConfig.database} TO ${databaseConfig.username};
`;

  return {
    createSQL,
    databaseConfig,
    estimatedTimeMs: tenant.plan === 'ENTERPRISE' ? 30000 : 10000,
  };
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
