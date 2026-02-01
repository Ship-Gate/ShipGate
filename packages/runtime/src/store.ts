/**
 * ISL Runtime Store
 * 
 * In-memory entity store implementation.
 */

import {
  type IslEntity,
  type IslValue,
  type EntityStore,
  type QueryFilter,
  type QueryOperator,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Store
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryStore implements EntityStore {
  private entities = new Map<string, Map<string, IslEntity>>();
  private indexes = new Map<string, Map<string, Set<string>>>();

  /**
   * Get an entity by type and ID
   */
  async get<T extends IslEntity>(type: string, id: string): Promise<T | null> {
    const typeMap = this.entities.get(type);
    if (!typeMap) return null;
    return (typeMap.get(id) as T) ?? null;
  }

  /**
   * Save an entity
   */
  async save<T extends IslEntity>(entity: T): Promise<void> {
    const type = entity.__type;
    const id = entity.__id;

    if (!this.entities.has(type)) {
      this.entities.set(type, new Map());
    }

    // Update indexes before saving
    const existing = await this.get(type, id);
    if (existing) {
      this.removeFromIndexes(existing);
    }

    this.entities.get(type)!.set(id, { ...entity });
    this.addToIndexes(entity);
  }

  /**
   * Delete an entity
   */
  async delete(type: string, id: string): Promise<void> {
    const entity = await this.get(type, id);
    if (entity) {
      this.removeFromIndexes(entity);
      this.entities.get(type)?.delete(id);
    }
  }

  /**
   * Query entities
   */
  async query<T extends IslEntity>(type: string, filter: QueryFilter): Promise<T[]> {
    const typeMap = this.entities.get(type);
    if (!typeMap) return [];

    let results = Array.from(typeMap.values()) as T[];

    // Apply where clause
    if (filter.where) {
      results = results.filter(entity => this.matchesWhere(entity, filter.where!));
    }

    // Apply ordering
    if (filter.orderBy && filter.orderBy.length > 0) {
      results.sort((a, b) => {
        for (const order of filter.orderBy!) {
          const aVal = a[order.field] as IslValue;
          const bVal = b[order.field] as IslValue;
          const cmp = this.compareValues(aVal, bVal);
          if (cmp !== 0) {
            return order.direction === 'asc' ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    // Apply offset
    if (filter.offset) {
      results = results.slice(filter.offset);
    }

    // Apply limit
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Count entities
   */
  async count(type: string, filter?: QueryFilter): Promise<number> {
    if (!filter?.where) {
      return this.entities.get(type)?.size ?? 0;
    }
    const results = await this.query(type, { where: filter.where });
    return results.length;
  }

  /**
   * Check if entity exists
   */
  async exists(type: string, id: string): Promise<boolean> {
    return (await this.get(type, id)) !== null;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.indexes.clear();
  }

  /**
   * Clear entities of a specific type
   */
  clearType(type: string): void {
    this.entities.delete(type);
    // Clear related indexes
    for (const [key, indexMap] of this.indexes) {
      if (key.startsWith(`${type}:`)) {
        this.indexes.delete(key);
      }
    }
  }

  /**
   * Get all entities of a type
   */
  async all<T extends IslEntity>(type: string): Promise<T[]> {
    return this.query(type, {});
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Index Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an index on a field
   */
  createIndex(type: string, field: string): void {
    const indexKey = `${type}:${field}`;
    if (!this.indexes.has(indexKey)) {
      this.indexes.set(indexKey, new Map());
      
      // Build index from existing data
      const typeMap = this.entities.get(type);
      if (typeMap) {
        for (const entity of typeMap.values()) {
          this.addToIndex(entity, field);
        }
      }
    }
  }

  private addToIndexes(entity: IslEntity): void {
    for (const [indexKey] of this.indexes) {
      const [type, field] = indexKey.split(':');
      if (type === entity.__type) {
        this.addToIndex(entity, field);
      }
    }
  }

  private removeFromIndexes(entity: IslEntity): void {
    for (const [indexKey, indexMap] of this.indexes) {
      const [type, field] = indexKey.split(':');
      if (type === entity.__type) {
        const value = String(entity[field]);
        indexMap.get(value)?.delete(entity.__id);
      }
    }
  }

  private addToIndex(entity: IslEntity, field: string): void {
    const indexKey = `${entity.__type}:${field}`;
    const indexMap = this.indexes.get(indexKey);
    if (!indexMap) return;

    const value = String(entity[field]);
    if (!indexMap.has(value)) {
      indexMap.set(value, new Set());
    }
    indexMap.get(value)!.add(entity.__id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Query Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private matchesWhere(entity: IslEntity, where: Record<string, IslValue | QueryOperator>): boolean {
    for (const [field, condition] of Object.entries(where)) {
      const value = entity[field];

      if (this.isQueryOperator(condition)) {
        if (!this.matchesOperator(value, condition)) {
          return false;
        }
      } else {
        // Direct equality
        if (!this.valuesEqual(value, condition)) {
          return false;
        }
      }
    }
    return true;
  }

  private isQueryOperator(value: unknown): value is QueryOperator {
    if (typeof value !== 'object' || value === null) return false;
    const keys = Object.keys(value);
    return keys.some(k => k.startsWith('$'));
  }

  private matchesOperator(value: IslValue, operator: QueryOperator): boolean {
    if (operator.$eq !== undefined) {
      if (!this.valuesEqual(value, operator.$eq)) return false;
    }
    if (operator.$ne !== undefined) {
      if (this.valuesEqual(value, operator.$ne)) return false;
    }
    if (operator.$gt !== undefined) {
      if (this.compareValues(value, operator.$gt) <= 0) return false;
    }
    if (operator.$gte !== undefined) {
      if (this.compareValues(value, operator.$gte) < 0) return false;
    }
    if (operator.$lt !== undefined) {
      if (this.compareValues(value, operator.$lt) >= 0) return false;
    }
    if (operator.$lte !== undefined) {
      if (this.compareValues(value, operator.$lte) > 0) return false;
    }
    if (operator.$in !== undefined) {
      if (!operator.$in.some(v => this.valuesEqual(value, v))) return false;
    }
    if (operator.$nin !== undefined) {
      if (operator.$nin.some(v => this.valuesEqual(value, v))) return false;
    }
    if (operator.$contains !== undefined) {
      if (typeof value !== 'string' || !value.includes(operator.$contains)) return false;
    }
    if (operator.$startsWith !== undefined) {
      if (typeof value !== 'string' || !value.startsWith(operator.$startsWith)) return false;
    }
    if (operator.$endsWith !== undefined) {
      if (typeof value !== 'string' || !value.endsWith(operator.$endsWith)) return false;
    }
    return true;
  }

  private valuesEqual(a: IslValue, b: IslValue): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.valuesEqual(v, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(k => this.valuesEqual((a as Record<string, IslValue>)[k], (b as Record<string, IslValue>)[k]));
    }
    return false;
  }

  private compareValues(a: IslValue, b: IslValue): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactional Store
// ─────────────────────────────────────────────────────────────────────────────

export class TransactionalStore implements EntityStore {
  private inner: EntityStore;
  private pending = new Map<string, IslEntity | null>(); // null means deleted
  private committed = false;

  constructor(inner: EntityStore) {
    this.inner = inner;
  }

  async get<T extends IslEntity>(type: string, id: string): Promise<T | null> {
    const key = `${type}:${id}`;
    if (this.pending.has(key)) {
      return this.pending.get(key) as T | null;
    }
    return this.inner.get(type, id);
  }

  async save<T extends IslEntity>(entity: T): Promise<void> {
    const key = `${entity.__type}:${entity.__id}`;
    this.pending.set(key, entity);
  }

  async delete(type: string, id: string): Promise<void> {
    const key = `${type}:${id}`;
    this.pending.set(key, null);
  }

  async query<T extends IslEntity>(type: string, filter: QueryFilter): Promise<T[]> {
    // For simplicity, just query inner store
    // A full implementation would merge pending changes
    return this.inner.query(type, filter);
  }

  async count(type: string, filter?: QueryFilter): Promise<number> {
    return this.inner.count(type, filter);
  }

  async exists(type: string, id: string): Promise<boolean> {
    const key = `${type}:${id}`;
    if (this.pending.has(key)) {
      return this.pending.get(key) !== null;
    }
    return this.inner.exists(type, id);
  }

  /**
   * Commit all pending changes
   */
  async commit(): Promise<void> {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }

    for (const [key, entity] of this.pending) {
      const [type, id] = key.split(':');
      if (entity === null) {
        await this.inner.delete(type, id);
      } else {
        await this.inner.save(entity);
      }
    }

    this.committed = true;
    this.pending.clear();
  }

  /**
   * Rollback all pending changes
   */
  rollback(): void {
    this.pending.clear();
    this.committed = true;
  }
}
