// ============================================================================
// ISL Standard Library - In-Memory Audit Store
// @stdlib/audit/trail/store
// ============================================================================

import type {
  AuditEntry,
  AuditEntryId,
  AuditStore,
  EventCategory,
  StoreQueryFilters,
} from '../types.js';

// ============================================================================
// IN-MEMORY STORE (reference implementation)
// ============================================================================

export class InMemoryAuditStore implements AuditStore {
  private entries: Map<string, AuditEntry> = new Map();

  async insert(entry: AuditEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async insertBatch(entries: AuditEntry[]): Promise<void> {
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
  }

  async findById(id: AuditEntryId): Promise<AuditEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async *query(filters: StoreQueryFilters): AsyncIterable<AuditEntry> {
    let yielded = 0;
    const offset = filters.offset ?? 0;
    let skipped = 0;

    const sorted = [...this.entries.values()].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    for (const entry of sorted) {
      if (!matchesFilters(entry, filters)) continue;

      if (skipped < offset) {
        skipped++;
        continue;
      }

      if (filters.limit !== undefined && yielded >= filters.limit) break;
      yield entry;
      yielded++;
    }
  }

  async count(filters: StoreQueryFilters): Promise<number> {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (matchesFilters(entry, filters)) count++;
    }
    return count;
  }

  async deleteOlderThan(date: Date, category?: EventCategory): Promise<number> {
    let deleted = 0;
    for (const [id, entry] of this.entries) {
      if (entry.timestamp < date) {
        if (category !== undefined && entry.category !== category) continue;
        this.entries.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Utility for tests
  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

// ============================================================================
// FILTER MATCHING
// ============================================================================

function matchesFilters(entry: AuditEntry, filters: StoreQueryFilters): boolean {
  if (filters.actor_id && entry.actor.id !== filters.actor_id) return false;
  if (filters.actor_type && entry.actor.type !== filters.actor_type) return false;
  if (filters.action && entry.action !== filters.action) return false;
  if (filters.action_prefix && !entry.action.startsWith(filters.action_prefix)) return false;
  if (filters.resource_type && entry.resource?.type !== filters.resource_type) return false;
  if (filters.resource_id && entry.resource?.id !== filters.resource_id) return false;
  if (filters.category && entry.category !== filters.category) return false;
  if (filters.categories && filters.categories.length > 0) {
    if (!filters.categories.includes(entry.category)) return false;
  }
  if (filters.outcome && entry.outcome !== filters.outcome) return false;
  if (filters.since && entry.timestamp < filters.since) return false;
  if (filters.until && entry.timestamp > filters.until) return false;
  if (filters.service && entry.source.service !== filters.service) return false;
  if (filters.tags && filters.tags.length > 0) {
    if (!entry.tags || !filters.tags.every((t) => entry.tags!.includes(t))) return false;
  }
  return true;
}
