import type { Database } from 'sql.js';
import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuditEvent,
  AuditActor,
  AuditRecord,
  ListAuditQuery,
  ExportAuditQuery,
} from './types.js';

// ── Genesis hash (seed for the hash chain) ──────────────────────────────

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ── SQL helpers (mirrors existing db/queries.ts pattern) ────────────────

function queryAll(
  db: Database,
  sql: string,
  params: Record<string, unknown> = {},
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(prefixParams(params));
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

function queryOne(
  db: Database,
  sql: string,
  params: Record<string, unknown> = {},
): Record<string, unknown> | undefined {
  const rows = queryAll(db, sql, params);
  return rows[0];
}

function prefixParams(params: Record<string, unknown>): Record<string, unknown> {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const k = key.startsWith('$') ? key : `$${key}`;
    prefixed[k] = value ?? null;
  }
  return prefixed;
}

// ── Hash chain ──────────────────────────────────────────────────────────

/**
 * Computes SHA-256 hash for a new audit record.
 * hash = sha256(previousHash + JSON(eventData))
 */
export function computeHash(previousHash: string, eventData: string): string {
  return createHash('sha256')
    .update(previousHash + eventData)
    .digest('hex');
}

// ── Row → AuditRecord ───────────────────────────────────────────────────

function rowToAuditRecord(row: Record<string, unknown>): AuditRecord {
  return {
    id: row['id'] as string,
    timestamp: row['timestamp'] as string,
    event: JSON.parse(row['event_data'] as string) as AuditEvent,
    actor: {
      id: row['actor_id'] as string,
      email: row['actor_email'] as string,
      role: row['actor_role'] as string,
    },
    metadata: JSON.parse((row['metadata'] as string) || '{}') as Record<string, unknown>,
    ip: (row['ip_address'] as string) || undefined,
    hash: row['hash'] as string,
    previousHash: row['previous_hash'] as string,
  };
}

// ── Query factory ───────────────────────────────────────────────────────

export function createAuditQueries(db: Database) {
  /**
   * Gets the hash of the most recent audit record (for chaining).
   * Returns the genesis hash if the table is empty.
   */
  function getLastHash(): string {
    const row = queryOne(
      db,
      'SELECT hash FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT 1',
    );
    return (row?.['hash'] as string) ?? GENESIS_HASH;
  }

  /**
   * Appends a new audit record. This is the only write operation —
   * there are no UPDATE or DELETE functions for tamper resistance.
   */
  function appendAuditRecord(
    event: AuditEvent,
    actor: AuditActor,
    metadata: Record<string, unknown> = {},
    ip?: string,
  ): AuditRecord {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const eventData = JSON.stringify(event);
    const metadataJson = JSON.stringify(metadata);

    const previousHash = getLastHash();
    const hash = computeHash(previousHash, eventData);

    db.run(
      `INSERT INTO audit_log
        (id, timestamp, event_type, event_data, actor_id, actor_email,
         actor_role, ip_address, metadata, hash, previous_hash)
       VALUES
        ($id, $timestamp, $event_type, $event_data, $actor_id, $actor_email,
         $actor_role, $ip_address, $metadata, $hash, $previous_hash)`,
      prefixParams({
        id,
        timestamp,
        event_type: event.type,
        event_data: eventData,
        actor_id: actor.id,
        actor_email: actor.email,
        actor_role: actor.role,
        ip_address: ip ?? null,
        metadata: metadataJson,
        hash,
        previous_hash: previousHash,
      }),
    );

    return {
      id,
      timestamp,
      event,
      actor,
      metadata,
      ip,
      hash,
      previousHash,
    };
  }

  /**
   * Lists audit records with pagination and optional filters.
   */
  function listAuditRecords(query: ListAuditQuery): {
    records: AuditRecord[];
    total: number;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.type) {
      conditions.push('event_type = $event_type');
      params['event_type'] = query.type;
    }
    if (query.actor) {
      conditions.push('actor_id = $actor_id');
      params['actor_id'] = query.actor;
    }
    if (query.from) {
      conditions.push('timestamp >= $from_ts');
      params['from_ts'] = query.from;
    }
    if (query.to) {
      conditions.push('timestamp <= $to_ts');
      params['to_ts'] = query.to;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.limit;

    const countRow = queryOne(
      db,
      `SELECT COUNT(*) as cnt FROM audit_log ${where}`,
      params,
    );
    const total = (countRow?.['cnt'] as number) ?? 0;

    const rows = queryAll(
      db,
      `SELECT * FROM audit_log ${where}
       ORDER BY timestamp DESC
       LIMIT $limit OFFSET $offset`,
      { ...params, limit: query.limit, offset },
    );

    return {
      records: rows.map(rowToAuditRecord),
      total,
    };
  }

  /**
   * Returns all matching records for CSV export (no pagination).
   */
  function exportAuditRecords(query: ExportAuditQuery): AuditRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.type) {
      conditions.push('event_type = $event_type');
      params['event_type'] = query.type;
    }
    if (query.actor) {
      conditions.push('actor_id = $actor_id');
      params['actor_id'] = query.actor;
    }
    if (query.from) {
      conditions.push('timestamp >= $from_ts');
      params['from_ts'] = query.from;
    }
    if (query.to) {
      conditions.push('timestamp <= $to_ts');
      params['to_ts'] = query.to;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = queryAll(
      db,
      `SELECT * FROM audit_log ${where} ORDER BY timestamp ASC`,
      params,
    );

    return rows.map(rowToAuditRecord);
  }

  /**
   * Retrieves a single audit record by ID.
   */
  function getAuditRecord(id: string): AuditRecord | undefined {
    const row = queryOne(db, 'SELECT * FROM audit_log WHERE id = $id', { id });
    return row ? rowToAuditRecord(row) : undefined;
  }

  /**
   * Verifies the integrity of the full hash chain.
   * Returns { valid: true } or { valid: false, brokenAtId } on first break.
   */
  function verifyHashChain(): { valid: boolean; brokenAtId?: string } {
    const rows = queryAll(
      db,
      'SELECT id, event_data, hash, previous_hash FROM audit_log ORDER BY created_at ASC, rowid ASC',
    );

    let expectedPreviousHash = GENESIS_HASH;

    for (const row of rows) {
      const recordPreviousHash = row['previous_hash'] as string;
      const recordHash = row['hash'] as string;
      const eventData = row['event_data'] as string;

      if (recordPreviousHash !== expectedPreviousHash) {
        return { valid: false, brokenAtId: row['id'] as string };
      }

      const recomputedHash = computeHash(recordPreviousHash, eventData);
      if (recomputedHash !== recordHash) {
        return { valid: false, brokenAtId: row['id'] as string };
      }

      expectedPreviousHash = recordHash;
    }

    return { valid: true };
  }

  return {
    appendAuditRecord,
    listAuditRecords,
    exportAuditRecords,
    getAuditRecord,
    getLastHash,
    verifyHashChain,
  };
}

export type AuditQueries = ReturnType<typeof createAuditQueries>;
