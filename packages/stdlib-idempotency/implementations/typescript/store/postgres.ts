// ============================================================================
// ISL Standard Library - PostgreSQL Idempotency Store
// @stdlib/idempotency/store/postgres
// ============================================================================

import {
  IdempotencyStore,
  IdempotencyRecord,
  IdempotencyKey,
  RequestHash,
  LockToken,
  RecordStatus,
  IdempotencyErrorCode,
  IdempotencyException,
  CheckInput,
  CheckResult,
  StartProcessingInput,
  LockResult,
  RecordInput,
  ReleaseLockInput,
  ReleaseResult,
  ExtendLockInput,
  ExtendResult,
  CleanupInput,
  CleanupResult,
  IdempotencyConfig,
  DEFAULT_CONFIG,
} from '../types';
import {
  validateKey,
  generateLockToken,
  calculateExpiration,
  validateResponseSize,
} from '../utils';

// Generic SQL client interface (compatible with pg, postgres, etc.)
export interface PostgresClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
  end?(): Promise<void>;
}

export interface PostgresPoolClient extends PostgresClient {
  release(): void;
}

export interface PostgresPool {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
  connect(): Promise<PostgresPoolClient>;
  end(): Promise<void>;
}

export interface PostgresStoreOptions extends IdempotencyConfig {
  /** PostgreSQL client or pool */
  client: PostgresClient | PostgresPool;
  
  /** Table name (default: 'idempotency_records') */
  tableName?: string;
  
  /** Schema name (default: 'public') */
  schemaName?: string;
  
  /** Auto-create table if not exists */
  autoCreateTable?: boolean;
}

interface DbRecord {
  key: string;
  request_hash: string;
  response: string | null;
  status: string;
  http_status_code: number | null;
  content_type: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  completed_at: Date | null;
  client_id: string | null;
  endpoint: string | null;
  method: string | null;
  lock_token: string | null;
  lock_expires_at: Date | null;
}

/**
 * PostgreSQL implementation of IdempotencyStore
 * 
 * Suitable for:
 * - Applications already using PostgreSQL
 * - Durable storage requirements
 * - Transaction support
 * 
 * Features:
 * - ACID transactions
 * - Row-level locking with SKIP LOCKED
 * - Automatic TTL-based cleanup via scheduled job
 */
export class PostgresIdempotencyStore implements IdempotencyStore {
  private client: PostgresClient | PostgresPool;
  private config: Required<Omit<PostgresStoreOptions, 'client' | 'autoCreateTable'>> & { autoCreateTable: boolean };
  private tableName: string;
  private initialized = false;

  constructor(options: PostgresStoreOptions) {
    this.client = options.client;
    this.config = {
      defaultTtl: options.defaultTtl ?? DEFAULT_CONFIG.defaultTtl,
      lockTimeout: options.lockTimeout ?? DEFAULT_CONFIG.lockTimeout,
      maxResponseSize: options.maxResponseSize ?? DEFAULT_CONFIG.maxResponseSize,
      maxKeyLength: options.maxKeyLength ?? DEFAULT_CONFIG.maxKeyLength,
      keyPrefix: options.keyPrefix ?? '',
      fingerprintHeaders: options.fingerprintHeaders ?? [],
      throwOnError: options.throwOnError ?? false,
      tableName: options.tableName ?? 'idempotency_records',
      schemaName: options.schemaName ?? 'public',
      autoCreateTable: options.autoCreateTable ?? true,
    };
    this.tableName = `"${this.config.schemaName}"."${this.config.tableName}"`;
  }

  /**
   * Initialize the store (create table if needed)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.autoCreateTable) {
      await this.createTable();
    }

    this.initialized = true;
  }

  private async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key VARCHAR(256) PRIMARY KEY,
        request_hash VARCHAR(64) NOT NULL,
        response TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
        http_status_code INTEGER,
        content_type VARCHAR(255),
        error_code VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        client_id VARCHAR(255),
        endpoint VARCHAR(1000),
        method VARCHAR(10),
        lock_token VARCHAR(50),
        lock_expires_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_expires_at 
        ON ${this.tableName} (expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_status 
        ON ${this.tableName} (status);
      
      CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_client_id 
        ON ${this.tableName} (client_id) 
        WHERE client_id IS NOT NULL;
    `;

    await this.client.query(sql);
  }

  // ============================================================================
  // CHECK
  // ============================================================================

  async check(input: CheckInput): Promise<CheckResult> {
    await this.initialize();

    const key = this.getKey(input.key);
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE key = $1 AND expires_at > NOW()
    `;

    const result = await this.client.query<DbRecord>(sql, [key]);

    if (result.rows.length === 0) {
      return {
        found: false,
        requestMismatch: false,
      };
    }

    const record = result.rows[0];
    const requestMismatch = record.request_hash !== input.requestHash;

    return {
      found: true,
      status: record.status as RecordStatus,
      response: requestMismatch ? undefined : record.response ?? undefined,
      httpStatusCode: requestMismatch ? undefined : record.http_status_code ?? undefined,
      contentType: requestMismatch ? undefined : record.content_type ?? undefined,
      requestMismatch,
      createdAt: record.created_at,
      completedAt: record.completed_at ?? undefined,
    };
  }

  // ============================================================================
  // START PROCESSING
  // ============================================================================

  async startProcessing(input: StartProcessingInput): Promise<LockResult> {
    await this.initialize();

    const validatedKey = validateKey(input.key, this.config.maxKeyLength);
    const key = this.getKey(input.key);
    const lockToken = generateLockToken();
    const lockTimeout = input.lockTimeout ?? this.config.lockTimeout;
    const now = new Date();
    const lockExpiresAt = calculateExpiration(lockTimeout, now);
    const expiresAt = calculateExpiration(this.config.defaultTtl, now);

    // Use advisory lock for the upsert operation
    const sql = `
      WITH existing AS (
        SELECT * FROM ${this.tableName}
        WHERE key = $1 AND expires_at > NOW()
        FOR UPDATE SKIP LOCKED
      ),
      inserted AS (
        INSERT INTO ${this.tableName} (
          key, request_hash, status, created_at, updated_at, expires_at,
          endpoint, method, client_id, lock_token, lock_expires_at
        )
        SELECT $1, $2, 'PROCESSING', $3, $3, $4, $5, $6, $7, $8, $9
        WHERE NOT EXISTS (SELECT 1 FROM existing WHERE status IN ('COMPLETED', 'PROCESSING'))
           OR EXISTS (SELECT 1 FROM existing WHERE status = 'FAILED')
           OR EXISTS (SELECT 1 FROM existing WHERE status = 'PROCESSING' AND lock_expires_at < NOW())
        ON CONFLICT (key) DO UPDATE SET
          status = 'PROCESSING',
          updated_at = $3,
          lock_token = $8,
          lock_expires_at = $9
        WHERE ${this.tableName}.status = 'FAILED'
           OR (${this.tableName}.status = 'PROCESSING' AND ${this.tableName}.lock_expires_at < NOW())
        RETURNING 'inserted' as _action, *
      )
      SELECT 
        COALESCE(i._action, 'existing') as _action,
        COALESCE(i.key, e.key) as key,
        COALESCE(i.request_hash, e.request_hash) as request_hash,
        COALESCE(i.status, e.status) as status,
        COALESCE(i.response, e.response) as response,
        COALESCE(i.http_status_code, e.http_status_code) as http_status_code,
        COALESCE(i.lock_token, e.lock_token) as lock_token,
        COALESCE(i.lock_expires_at, e.lock_expires_at) as lock_expires_at
      FROM existing e
      FULL OUTER JOIN inserted i ON true
      LIMIT 1
    `;

    const result = await this.client.query<DbRecord & { _action: string }>(sql, [
      key,
      input.requestHash,
      now,
      expiresAt,
      input.endpoint,
      input.method,
      input.clientId,
      lockToken,
      lockExpiresAt,
    ]);

    // No existing record and insert succeeded
    if (result.rows.length === 0 || result.rows[0]._action === 'inserted') {
      return {
        acquired: true,
        lockToken: lockToken as LockToken,
        lockExpiresAt,
      };
    }

    const record = result.rows[0];

    // Check for request mismatch
    if (record.request_hash !== input.requestHash) {
      return {
        acquired: false,
        existingStatus: record.status as RecordStatus,
        requestMismatch: true,
      };
    }

    // Return cached response for completed requests
    if (record.status === RecordStatus.COMPLETED) {
      return {
        acquired: false,
        existingStatus: record.status as RecordStatus,
        existingResponse: record.response ?? undefined,
        existingHttpStatusCode: record.http_status_code ?? undefined,
      };
    }

    // Concurrent processing
    return {
      acquired: false,
      existingStatus: record.status as RecordStatus,
    };
  }

  // ============================================================================
  // RECORD
  // ============================================================================

  async record(input: RecordInput): Promise<IdempotencyRecord> {
    await this.initialize();

    const key = this.getKey(input.key);
    const now = new Date();

    // Validate response size
    validateResponseSize(input.response, this.config.maxResponseSize);

    const ttl = input.ttl ?? this.config.defaultTtl;
    const expiresAt = calculateExpiration(ttl, now);
    const status = input.markAsFailed ? RecordStatus.FAILED : RecordStatus.COMPLETED;

    let sql: string;
    let values: unknown[];

    if (input.lockToken) {
      // Verify lock token
      sql = `
        UPDATE ${this.tableName}
        SET 
          response = $2,
          status = $3,
          http_status_code = $4,
          content_type = $5,
          error_code = $6,
          error_message = $7,
          updated_at = $8,
          completed_at = $8,
          expires_at = $9,
          lock_token = NULL,
          lock_expires_at = NULL
        WHERE key = $1 AND lock_token = $10
        RETURNING *
      `;
      values = [
        key,
        input.response,
        status,
        input.httpStatusCode,
        input.contentType,
        input.errorCode,
        input.errorMessage,
        now,
        expiresAt,
        input.lockToken,
      ];
    } else {
      // Upsert without lock verification
      sql = `
        INSERT INTO ${this.tableName} (
          key, request_hash, response, status, http_status_code,
          content_type, error_code, error_message, created_at,
          updated_at, expires_at, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $9)
        ON CONFLICT (key) DO UPDATE SET
          response = $3,
          status = $4,
          http_status_code = $5,
          content_type = $6,
          error_code = $7,
          error_message = $8,
          updated_at = $9,
          completed_at = $9,
          expires_at = $10,
          lock_token = NULL,
          lock_expires_at = NULL
        RETURNING *
      `;
      values = [
        key,
        input.requestHash,
        input.response,
        status,
        input.httpStatusCode,
        input.contentType,
        input.errorCode,
        input.errorMessage,
        now,
        expiresAt,
      ];
    }

    const result = await this.client.query<DbRecord>(sql, values);

    if (result.rows.length === 0) {
      throw new IdempotencyException(
        input.lockToken
          ? IdempotencyErrorCode.LOCK_ACQUISITION_FAILED
          : IdempotencyErrorCode.RECORD_NOT_FOUND,
        input.lockToken ? 'Lock token mismatch' : `Record not found for key: ${input.key}`
      );
    }

    return this.mapRecord(result.rows[0]);
  }

  // ============================================================================
  // RELEASE LOCK
  // ============================================================================

  async releaseLock(input: ReleaseLockInput): Promise<ReleaseResult> {
    await this.initialize();

    const key = this.getKey(input.key);
    const now = new Date();

    if (input.markFailed) {
      const sql = `
        UPDATE ${this.tableName}
        SET 
          status = 'FAILED',
          error_code = $3,
          error_message = $4,
          updated_at = $5,
          lock_token = NULL,
          lock_expires_at = NULL
        WHERE key = $1 AND lock_token = $2
        RETURNING *
      `;

      const result = await this.client.query(sql, [
        key,
        input.lockToken,
        input.errorCode,
        input.errorMessage,
        now,
      ]);

      if (result.rowCount === 0) {
        throw new IdempotencyException(
          IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
          'Lock token mismatch or record not found'
        );
      }

      return {
        released: true,
        recordDeleted: false,
        recordMarkedFailed: true,
      };
    }

    const sql = `
      DELETE FROM ${this.tableName}
      WHERE key = $1 AND lock_token = $2
    `;

    const result = await this.client.query(sql, [key, input.lockToken]);

    if (result.rowCount === 0) {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch or record not found'
      );
    }

    return {
      released: true,
      recordDeleted: true,
      recordMarkedFailed: false,
    };
  }

  // ============================================================================
  // EXTEND LOCK
  // ============================================================================

  async extendLock(input: ExtendLockInput): Promise<ExtendResult> {
    await this.initialize();

    const key = this.getKey(input.key);
    const now = new Date();
    const newExpiresAt = calculateExpiration(input.extension, now);

    const sql = `
      UPDATE ${this.tableName}
      SET 
        lock_expires_at = $3,
        updated_at = $4
      WHERE key = $1 
        AND lock_token = $2 
        AND lock_expires_at > NOW()
      RETURNING *
    `;

    const result = await this.client.query(sql, [key, input.lockToken, newExpiresAt, now]);

    if (result.rowCount === 0) {
      // Check if lock expired or token mismatch
      const checkSql = `SELECT lock_token, lock_expires_at FROM ${this.tableName} WHERE key = $1`;
      const checkResult = await this.client.query<{ lock_token: string; lock_expires_at: Date }>(
        checkSql,
        [key]
      );

      if (checkResult.rows.length === 0) {
        throw new IdempotencyException(
          IdempotencyErrorCode.RECORD_NOT_FOUND,
          `Record not found for key: ${input.key}`
        );
      }

      const record = checkResult.rows[0];
      if (record.lock_token !== input.lockToken) {
        throw new IdempotencyException(
          IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
          'Lock token mismatch'
        );
      }

      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_EXPIRED,
        'Lock has already expired'
      );
    }

    return {
      extended: true,
      newExpiresAt,
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(input: CleanupInput): Promise<CleanupResult> {
    await this.initialize();

    const startTime = Date.now();
    const batchSize = input.batchSize ?? 1000;
    const maxRecords = input.maxRecords ?? Infinity;

    let deletedCount = 0;
    let batchesProcessed = 0;
    let oldestRemaining: Date | undefined;
    let nextExpiration: Date | undefined;

    const conditions: string[] = ['expires_at <= NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.keyPrefix) {
      conditions.push(`key LIKE $${paramIndex++}`);
      values.push(`${input.keyPrefix}%`);
    }

    if (input.clientId) {
      conditions.push(`client_id = $${paramIndex++}`);
      values.push(input.clientId);
    }

    if (input.forceBefore) {
      conditions[0] = `(expires_at <= NOW() OR created_at < $${paramIndex++})`;
      values.push(input.forceBefore);
    }

    const whereClause = conditions.join(' AND ');

    if (!input.dryRun) {
      // Delete in batches
      while (deletedCount < maxRecords) {
        const remainingLimit = Math.min(batchSize, maxRecords - deletedCount);
        const deleteSql = `
          DELETE FROM ${this.tableName}
          WHERE key IN (
            SELECT key FROM ${this.tableName}
            WHERE ${whereClause}
            LIMIT $${paramIndex}
            FOR UPDATE SKIP LOCKED
          )
        `;

        const result = await this.client.query(deleteSql, [...values, remainingLimit]);
        
        if (result.rowCount === 0) break;
        
        deletedCount += result.rowCount;
        batchesProcessed++;
      }
    } else {
      // Dry run - just count
      const countSql = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE ${whereClause}
      `;
      const result = await this.client.query<{ count: string }>(countSql, values);
      deletedCount = parseInt(result.rows[0].count, 10);
    }

    // Get stats about remaining records
    const statsSql = `
      SELECT 
        MIN(created_at) as oldest,
        MIN(expires_at) as next_expiration
      FROM ${this.tableName}
      WHERE expires_at > NOW()
    `;
    const statsResult = await this.client.query<{ oldest: Date; next_expiration: Date }>(statsSql);

    if (statsResult.rows.length > 0 && statsResult.rows[0].oldest) {
      oldestRemaining = statsResult.rows[0].oldest;
      nextExpiration = statsResult.rows[0].next_expiration;
    }

    return {
      deletedCount,
      batchesProcessed,
      oldestRemaining,
      nextExpiration,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  async get(key: string): Promise<IdempotencyRecord | null> {
    await this.initialize();

    const internalKey = this.getKey(key);
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE key = $1 AND expires_at > NOW()
    `;

    const result = await this.client.query<DbRecord>(sql, [internalKey]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRecord(result.rows[0]);
  }

  async delete(key: string): Promise<boolean> {
    await this.initialize();

    const internalKey = this.getKey(key);
    const sql = `DELETE FROM ${this.tableName} WHERE key = $1`;
    const result = await this.client.query(sql, [internalKey]);

    return result.rowCount > 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if ('end' in this.client && typeof this.client.end === 'function') {
      await this.client.end();
    }
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private getKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  private mapRecord(row: DbRecord): IdempotencyRecord {
    return {
      key: row.key as IdempotencyKey,
      requestHash: row.request_hash as RequestHash,
      response: row.response ?? undefined,
      status: row.status as RecordStatus,
      httpStatusCode: row.http_status_code ?? undefined,
      contentType: row.content_type ?? undefined,
      errorCode: row.error_code ?? undefined,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      completedAt: row.completed_at ?? undefined,
      clientId: row.client_id ?? undefined,
      endpoint: row.endpoint ?? undefined,
      method: row.method ?? undefined,
      lockToken: row.lock_token as LockToken | undefined,
      lockExpiresAt: row.lock_expires_at ?? undefined,
    };
  }
}

/**
 * Create a new PostgreSQL store instance
 */
export function createPostgresStore(options: PostgresStoreOptions): PostgresIdempotencyStore {
  return new PostgresIdempotencyStore(options);
}

/**
 * SQL for creating the idempotency table manually
 */
export const CREATE_TABLE_SQL = (tableName = 'idempotency_records', schemaName = 'public') => `
  CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (
    key VARCHAR(256) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    http_status_code INTEGER,
    content_type VARCHAR(255),
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    client_id VARCHAR(255),
    endpoint VARCHAR(1000),
    method VARCHAR(10),
    lock_token VARCHAR(50),
    lock_expires_at TIMESTAMP WITH TIME ZONE
  );

  CREATE INDEX IF NOT EXISTS idx_${tableName}_expires_at 
    ON "${schemaName}"."${tableName}" (expires_at);
  
  CREATE INDEX IF NOT EXISTS idx_${tableName}_status 
    ON "${schemaName}"."${tableName}" (status);
  
  CREATE INDEX IF NOT EXISTS idx_${tableName}_client_id 
    ON "${schemaName}"."${tableName}" (client_id) 
    WHERE client_id IS NOT NULL;

  -- Cleanup function for scheduled job
  CREATE OR REPLACE FUNCTION ${schemaName}.cleanup_expired_idempotency_records()
  RETURNS INTEGER AS $$
  DECLARE
    deleted_count INTEGER;
  BEGIN
    DELETE FROM "${schemaName}"."${tableName}"
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
  END;
  $$ LANGUAGE plpgsql;
`;
