/**
 * Database Adapters — Registry and factory
 */

import type { DatabaseAdapter, DatabaseAdapterId } from './database-adapter.js';
import { SQLiteAdapter } from './sqlite-adapter.js';
import { PostgresAdapter } from './postgres-adapter.js';

const ADAPTERS: Record<DatabaseAdapterId, DatabaseAdapter> = {
  sqlite: SQLiteAdapter,
  postgres: PostgresAdapter,
};

export type { DatabaseAdapter, DatabaseAdapterId } from './database-adapter.js';
export { SQLiteAdapter } from './sqlite-adapter.js';
export { PostgresAdapter, getPgBouncerUrl } from './postgres-adapter.js';

/**
 * Get adapter by ID. Defaults to sqlite if unknown.
 */
export function getDatabaseAdapter(id: string | DatabaseAdapterId): DatabaseAdapter {
  const normalized = (id?.toLowerCase() ?? 'sqlite') as DatabaseAdapterId;
  return ADAPTERS[normalized] ?? ADAPTERS.sqlite;
}

/**
 * List all adapter IDs.
 */
export function getAdapterIds(): DatabaseAdapterId[] {
  return ['sqlite', 'postgres'];
}
