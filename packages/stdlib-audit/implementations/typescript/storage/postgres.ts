// ============================================================================
// ISL Standard Library - PostgreSQL Audit Storage
// @stdlib/audit/storage/postgres
// ============================================================================

import type {
  AuditStorage,
  AuditEvent,
  AuditEventId,
  QueryInput,
  AuditQueryResult,
  StatsInput,
  AuditStats,
  AuditFilters,
  EventCategory,
  EventOutcome,
  ActorType,
  SortDirection,
} from '../types';

// ============================================================================
// POSTGRES CLIENT INTERFACE
// ============================================================================

export interface PostgresClient {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  connect(): Promise<void>;
  end(): Promise<void>;
}

// ============================================================================
// POSTGRES STORAGE OPTIONS
// ============================================================================

export interface PostgresAuditStorageOptions {
  client: PostgresClient;
  tableName?: string;
  schema?: string;
  
  // Partitioning
  partitionByMonth?: boolean;
  
  // Indexes
  createIndexes?: boolean;
}

// ============================================================================
// POSTGRES AUDIT STORAGE
// ============================================================================

export class PostgresAuditStorage implements AuditStorage {
  private client: PostgresClient;
  private tableName: string;
  private schema: string;
  private fullTableName: string;

  constructor(options: PostgresAuditStorageOptions) {
    this.client = options.client;
    this.tableName = options.tableName ?? 'audit_events';
    this.schema = options.schema ?? 'public';
    this.fullTableName = `"${this.schema}"."${this.tableName}"`;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async initialize(): Promise<void> {
    await this.createTable();
    await this.createIndexes();
  }

  private async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.fullTableName} (
        id UUID PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        outcome VARCHAR(20) NOT NULL,
        description TEXT,
        
        -- Actor (JSON)
        actor JSONB NOT NULL,
        
        -- Resource (JSON, nullable)
        resource JSONB,
        
        -- Source (JSON)
        source JSONB NOT NULL,
        
        -- Additional data
        metadata JSONB,
        tags TEXT[],
        changes JSONB,
        
        -- Error details
        error_code VARCHAR(100),
        error_message TEXT,
        
        -- Timing
        timestamp TIMESTAMPTZ NOT NULL,
        duration_ms INTEGER,
        
        -- Compliance
        retention_until TIMESTAMPTZ,
        compliance_flags TEXT[],
        
        -- Integrity
        hash VARCHAR(64),
        previous_hash VARCHAR(64),
        
        -- Audit metadata
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await this.client.query(sql);
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.fullTableName} (timestamp DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_category ON ${this.fullTableName} (category)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_outcome ON ${this.fullTableName} (outcome)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_action ON ${this.fullTableName} (action)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_actor_id ON ${this.fullTableName} ((actor->>'id'))`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_resource_id ON ${this.fullTableName} ((resource->>'id'))`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source_service ON ${this.fullTableName} ((source->>'service'))`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_tags ON ${this.fullTableName} USING GIN (tags)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_retention ON ${this.fullTableName} (retention_until) WHERE retention_until IS NOT NULL`,
    ];

    for (const sql of indexes) {
      await this.client.query(sql);
    }
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  async insert(event: AuditEvent): Promise<void> {
    const sql = `
      INSERT INTO ${this.fullTableName} (
        id, action, category, outcome, description,
        actor, resource, source, metadata, tags, changes,
        error_code, error_message, timestamp, duration_ms,
        retention_until, compliance_flags, hash, previous_hash
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19
      )
    `;

    await this.client.query(sql, [
      event.id,
      event.action,
      event.category,
      event.outcome,
      event.description,
      JSON.stringify(event.actor),
      event.resource ? JSON.stringify(event.resource) : null,
      JSON.stringify(event.source),
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.tags,
      event.changes ? JSON.stringify(event.changes) : null,
      event.error_code,
      event.error_message,
      event.timestamp,
      event.duration_ms,
      event.retention_until,
      event.compliance_flags,
      event.hash,
      event.previous_hash,
    ]);
  }

  async insertBatch(events: AuditEvent[]): Promise<void> {
    if (events.length === 0) return;

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const event of events) {
      const placeholders = Array.from({ length: 19 }, () => `$${paramIndex++}`).join(', ');
      values.push(`(${placeholders})`);
      params.push(
        event.id,
        event.action,
        event.category,
        event.outcome,
        event.description,
        JSON.stringify(event.actor),
        event.resource ? JSON.stringify(event.resource) : null,
        JSON.stringify(event.source),
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.tags,
        event.changes ? JSON.stringify(event.changes) : null,
        event.error_code,
        event.error_message,
        event.timestamp,
        event.duration_ms,
        event.retention_until,
        event.compliance_flags,
        event.hash,
        event.previous_hash
      );
    }

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id, action, category, outcome, description,
        actor, resource, source, metadata, tags, changes,
        error_code, error_message, timestamp, duration_ms,
        retention_until, compliance_flags, hash, previous_hash
      ) VALUES ${values.join(', ')}
    `;

    await this.client.query(sql, params);
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  async findById(id: AuditEventId): Promise<AuditEvent | null> {
    const sql = `SELECT * FROM ${this.fullTableName} WHERE id = $1`;
    const result = await this.client.query(sql, [id]);
    
    if (result.rows.length === 0) return null;
    return this.rowToEvent(result.rows[0]);
  }

  async query(input: QueryInput): Promise<AuditQueryResult> {
    const { whereClauses, params } = this.buildWhereClause(input.filters);
    
    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${this.fullTableName}
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    // Main query
    const offset = (input.pagination.page - 1) * input.pagination.page_size;
    const sortField = input.sort?.field ?? 'timestamp';
    const sortDir = input.sort?.direction ?? SortDirection.DESC;

    let selectFields = '*';
    if (input.fields && input.fields.length > 0) {
      selectFields = input.fields
        .map(f => this.sanitizeFieldName(f))
        .join(', ');
    }

    const dataSql = `
      SELECT ${selectFields}
      FROM ${this.fullTableName}
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ORDER BY ${this.sanitizeFieldName(sortField)} ${sortDir}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const dataResult = await this.client.query(dataSql, [
      ...params,
      input.pagination.page_size,
      offset,
    ]);

    const events = dataResult.rows.map(row => this.rowToEvent(row));

    return {
      events,
      total_count: totalCount,
      page: input.pagination.page,
      page_size: input.pagination.page_size,
      has_more: offset + events.length < totalCount,
    };
  }

  async getStats(input: StatsInput): Promise<AuditStats> {
    const { whereClauses, params } = this.buildWhereClause(input.filters);
    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const totalSql = `SELECT COUNT(*) as total FROM ${this.fullTableName} ${whereStr}`;
    const totalResult = await this.client.query(totalSql, params);
    const totalEvents = parseInt(totalResult.rows[0].total, 10);

    // By category
    const categorySql = `
      SELECT category, COUNT(*) as count
      FROM ${this.fullTableName}
      ${whereStr}
      GROUP BY category
    `;
    const categoryResult = await this.client.query(categorySql, params);
    const byCategory: Record<EventCategory, number> = {} as any;
    for (const row of categoryResult.rows) {
      byCategory[row.category as EventCategory] = parseInt(row.count, 10);
    }

    // By outcome
    const outcomeSql = `
      SELECT outcome, COUNT(*) as count
      FROM ${this.fullTableName}
      ${whereStr}
      GROUP BY outcome
    `;
    const outcomeResult = await this.client.query(outcomeSql, params);
    const byOutcome: Record<EventOutcome, number> = {} as any;
    for (const row of outcomeResult.rows) {
      byOutcome[row.outcome as EventOutcome] = parseInt(row.count, 10);
    }

    // By service
    const serviceSql = `
      SELECT source->>'service' as service, COUNT(*) as count
      FROM ${this.fullTableName}
      ${whereStr}
      GROUP BY source->>'service'
    `;
    const serviceResult = await this.client.query(serviceSql, params);
    const byService: Record<string, number> = {};
    for (const row of serviceResult.rows) {
      byService[row.service] = parseInt(row.count, 10);
    }

    return {
      total_events: totalEvents,
      by_category: byCategory,
      by_outcome: byOutcome,
      by_service: byService,
    };
  }

  // ==========================================================================
  // MAINTENANCE
  // ==========================================================================

  async deleteOlderThan(date: Date): Promise<number> {
    const sql = `
      DELETE FROM ${this.fullTableName}
      WHERE retention_until IS NOT NULL AND retention_until < $1
    `;
    const result = await this.client.query(sql, [date]);
    return (result as any).rowCount ?? 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private buildWhereClause(filters?: AuditFilters): { whereClauses: string[]; params: unknown[] } {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (!filters) return { whereClauses, params };

    if (filters.actor_id) {
      whereClauses.push(`actor->>'id' = $${paramIndex++}`);
      params.push(filters.actor_id);
    }

    if (filters.actor_type) {
      whereClauses.push(`actor->>'type' = $${paramIndex++}`);
      params.push(filters.actor_type);
    }

    if (filters.resource_type) {
      whereClauses.push(`resource->>'type' = $${paramIndex++}`);
      params.push(filters.resource_type);
    }

    if (filters.resource_id) {
      whereClauses.push(`resource->>'id' = $${paramIndex++}`);
      params.push(filters.resource_id);
    }

    if (filters.action) {
      whereClauses.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }

    if (filters.action_prefix) {
      whereClauses.push(`action LIKE $${paramIndex++}`);
      params.push(`${filters.action_prefix}%`);
    }

    if (filters.category) {
      whereClauses.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.categories && filters.categories.length > 0) {
      whereClauses.push(`category = ANY($${paramIndex++})`);
      params.push(filters.categories);
    }

    if (filters.outcome) {
      whereClauses.push(`outcome = $${paramIndex++}`);
      params.push(filters.outcome);
    }

    if (filters.timestamp_start) {
      whereClauses.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.timestamp_start);
    }

    if (filters.timestamp_end) {
      whereClauses.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.timestamp_end);
    }

    if (filters.service) {
      whereClauses.push(`source->>'service' = $${paramIndex++}`);
      params.push(filters.service);
    }

    if (filters.environment) {
      whereClauses.push(`source->>'environment' = $${paramIndex++}`);
      params.push(filters.environment);
    }

    if (filters.request_id) {
      whereClauses.push(`source->>'request_id' = $${paramIndex++}`);
      params.push(filters.request_id);
    }

    if (filters.tags && filters.tags.length > 0) {
      if (filters.tags_match === 'ALL') {
        whereClauses.push(`tags @> $${paramIndex++}`);
      } else {
        whereClauses.push(`tags && $${paramIndex++}`);
      }
      params.push(filters.tags);
    }

    return { whereClauses, params };
  }

  private rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      action: row.action,
      category: row.category,
      outcome: row.outcome,
      description: row.description,
      actor: typeof row.actor === 'string' ? JSON.parse(row.actor) : row.actor,
      resource: row.resource ? (typeof row.resource === 'string' ? JSON.parse(row.resource) : row.resource) : undefined,
      source: typeof row.source === 'string' ? JSON.parse(row.source) : row.source,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      tags: row.tags,
      changes: row.changes ? (typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes) : undefined,
      error_code: row.error_code,
      error_message: row.error_message,
      timestamp: new Date(row.timestamp),
      duration_ms: row.duration_ms,
      retention_until: row.retention_until ? new Date(row.retention_until) : undefined,
      compliance_flags: row.compliance_flags,
      hash: row.hash,
      previous_hash: row.previous_hash,
    };
  }

  private sanitizeFieldName(field: string): string {
    // Allow only alphanumeric, underscore, and specific JSON paths
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      return `"${field}"`;
    }
    // Handle JSON paths like actor.id
    if (/^[a-zA-Z_]+\.[a-zA-Z_]+$/.test(field)) {
      const [obj, prop] = field.split('.');
      return `${obj}->>'${prop}'`;
    }
    return '"timestamp"'; // Default fallback
  }
}
