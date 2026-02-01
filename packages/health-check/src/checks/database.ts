/**
 * Database Health Checks
 * 
 * Health check implementations for various database systems.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  DatabaseCheckConfig,
  DatabaseConnection,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Database Check Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a database health check
 */
export function createDatabaseCheck(config: DatabaseCheckConfig): HealthCheckConfig {
  return {
    name: config.name,
    critical: config.critical ?? true,
    timeout: config.timeout ?? 5000,
    check: async () => performDatabaseCheck(config),
  };
}

/**
 * Perform the actual database health check
 */
async function performDatabaseCheck(config: DatabaseCheckConfig): Promise<CheckResult> {
  const start = Date.now();

  try {
    switch (config.type) {
      case 'postgresql':
        return await checkPostgreSQL(config, start);
      case 'mysql':
        return await checkMySQL(config, start);
      case 'mongodb':
        return await checkMongoDB(config, start);
      case 'sqlite':
        return await checkSQLite(config, start);
      default:
        return {
          status: 'unhealthy',
          message: `Unknown database type: ${config.type}`,
          timestamp: Date.now(),
        };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PostgreSQL Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkPostgreSQL(config: DatabaseCheckConfig, start: number): Promise<CheckResult> {
  const query = config.query ?? 'SELECT 1';
  
  try {
    // Dynamic import to avoid hard dependency
    const pg = await import('pg');
    const pool = new pg.Pool({
      connectionString: config.connectionString,
      connectionTimeoutMillis: config.timeout ?? 5000,
    });

    try {
      const result = await pool.query(query);
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'healthy' : 'degraded',
        latency,
        details: {
          rowCount: result.rowCount,
          type: 'postgresql',
        },
        timestamp: Date.now(),
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    // If pg is not installed, try with provided connection
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'PostgreSQL driver (pg) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MySQL Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkMySQL(config: DatabaseCheckConfig, start: number): Promise<CheckResult> {
  const query = config.query ?? 'SELECT 1';

  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      uri: config.connectionString,
      connectTimeout: config.timeout ?? 5000,
    });

    try {
      await connection.query(query);
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'healthy' : 'degraded',
        latency,
        details: { type: 'mysql' },
        timestamp: Date.now(),
      };
    } finally {
      await connection.end();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'MySQL driver (mysql2) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MongoDB Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkMongoDB(config: DatabaseCheckConfig, start: number): Promise<CheckResult> {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(config.connectionString ?? 'mongodb://localhost:27017', {
      serverSelectionTimeoutMS: config.timeout ?? 5000,
    });

    try {
      await client.connect();
      await client.db().admin().ping();
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'healthy' : 'degraded',
        latency,
        details: { type: 'mongodb' },
        timestamp: Date.now(),
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'MongoDB driver (mongodb) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SQLite Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkSQLite(config: DatabaseCheckConfig, start: number): Promise<CheckResult> {
  const query = config.query ?? 'SELECT 1';

  try {
    const sqlite3 = await import('better-sqlite3');
    const db = sqlite3.default(config.connectionString ?? ':memory:');

    try {
      db.exec(query);
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        details: { type: 'sqlite' },
        timestamp: Date.now(),
      };
    } finally {
      db.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'SQLite driver (better-sqlite3) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic Database Check with Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a database check using an existing connection
 */
export function createDatabaseCheckWithConnection(
  name: string,
  connection: DatabaseConnection,
  options: {
    query?: string;
    critical?: boolean;
    timeout?: number;
  } = {}
): HealthCheckConfig {
  const query = options.query ?? 'SELECT 1';

  return {
    name,
    critical: options.critical ?? true,
    timeout: options.timeout ?? 5000,
    check: async () => {
      const start = Date.now();

      try {
        await Promise.race([
          connection.query(query),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), options.timeout ?? 5000)
          ),
        ]);

        const latency = Date.now() - start;

        return {
          status: latency < 500 ? 'healthy' : 'degraded',
          latency,
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Query failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection Pool Check
// ═══════════════════════════════════════════════════════════════════════════

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/**
 * Create a check for database connection pool health
 */
export function createPoolHealthCheck(
  name: string,
  getPoolStats: () => PoolStats | Promise<PoolStats>,
  options: {
    maxWaiting?: number;
    minIdle?: number;
    critical?: boolean;
  } = {}
): HealthCheckConfig {
  const maxWaiting = options.maxWaiting ?? 10;
  const minIdle = options.minIdle ?? 1;

  return {
    name: `${name}-pool`,
    critical: options.critical ?? false,
    check: async () => {
      const start = Date.now();

      try {
        const stats = await getPoolStats();

        let status: CheckResult['status'] = 'healthy';
        const messages: string[] = [];

        if (stats.waitingCount > maxWaiting) {
          status = 'degraded';
          messages.push(`High waiting count: ${stats.waitingCount}`);
        }

        if (stats.idleCount < minIdle) {
          status = 'degraded';
          messages.push(`Low idle connections: ${stats.idleCount}`);
        }

        return {
          status,
          latency: Date.now() - start,
          message: messages.join('; ') || undefined,
          details: {
            total: stats.totalCount,
            idle: stats.idleCount,
            waiting: stats.waitingCount,
          },
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Failed to get pool stats',
          timestamp: Date.now(),
        };
      }
    },
  };
}
