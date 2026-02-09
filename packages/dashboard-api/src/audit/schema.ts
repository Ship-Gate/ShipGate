import type { Database } from 'sql.js';

/**
 * SQL schema for the audit_log table.
 * Records are append-only — no UPDATE or DELETE statements exist in the codebase.
 */
export const AUDIT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id             TEXT PRIMARY KEY,
    timestamp      TEXT NOT NULL,
    event_type     TEXT NOT NULL,
    event_data     TEXT NOT NULL,
    actor_id       TEXT,
    actor_email    TEXT,
    actor_role     TEXT,
    ip_address     TEXT,
    metadata       TEXT NOT NULL DEFAULT '{}',
    hash           TEXT NOT NULL,
    previous_hash  TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_audit_type      ON audit_log(event_type);
  CREATE INDEX IF NOT EXISTS idx_audit_actor     ON audit_log(actor_id);
`;

/**
 * Ensures the audit_log table and indexes exist.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export function ensureAuditSchema(db: Database): void {
  db.run(AUDIT_SCHEMA_SQL);
}
