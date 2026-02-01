/**
 * State Manager
 * 
 * Manages entity state with snapshots for contract checking.
 */

import type { StateAdapter } from './runtime.js';

// ============================================================================
// Types
// ============================================================================

export interface EntityState {
  id: string;
  type: string;
  data: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StateSnapshot {
  timestamp: Date;
  entities: Map<string, EntityState>;
}

// ============================================================================
// State Manager
// ============================================================================

export class StateManager {
  private adapter: StateAdapter;
  private cache: Map<string, EntityState> = new Map();

  constructor(adapter: StateAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get entity by key
   */
  async get<T extends EntityState>(type: string, id: string): Promise<T | null> {
    const key = `${type}:${id}`;
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    // Load from adapter
    const entity = await this.adapter.get<T>(key);
    if (entity) {
      this.cache.set(key, entity);
    }
    return entity;
  }

  /**
   * Save entity
   */
  async save<T extends EntityState>(entity: T): Promise<T> {
    const key = `${entity.type}:${entity.id}`;
    entity.updatedAt = new Date();
    entity.version++;
    
    await this.adapter.set(key, entity);
    this.cache.set(key, entity);
    
    return entity;
  }

  /**
   * Create new entity
   */
  async create<T extends Record<string, unknown>>(
    type: string,
    id: string,
    data: T
  ): Promise<EntityState> {
    const entity: EntityState = {
      id,
      type,
      data,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const key = `${type}:${id}`;
    await this.adapter.set(key, entity);
    this.cache.set(key, entity);

    return entity;
  }

  /**
   * Delete entity
   */
  async delete(type: string, id: string): Promise<void> {
    const key = `${type}:${id}`;
    await this.adapter.delete(key);
    this.cache.delete(key);
  }

  /**
   * Check if entity exists
   */
  async exists(type: string, id: string): Promise<boolean> {
    const entity = await this.get(type, id);
    return entity !== null;
  }

  /**
   * Find entities by query
   */
  async find<T extends EntityState>(
    type: string,
    predicate: (entity: T) => boolean
  ): Promise<T[]> {
    // In-memory implementation - production would use proper query
    const results: T[] = [];
    for (const [key, entity] of this.cache) {
      if (key.startsWith(`${type}:`) && predicate(entity as T)) {
        results.push(entity as T);
      }
    }
    return results;
  }

  /**
   * Count entities
   */
  async count(type: string): Promise<number> {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) count++;
    }
    return count;
  }

  /**
   * Capture state snapshot
   */
  async captureSnapshot(): Promise<StateSnapshot> {
    return {
      timestamp: new Date(),
      entities: new Map(this.cache),
    };
  }

  /**
   * Get current state as map
   */
  async getSnapshot(): Promise<Map<string, unknown>> {
    const snapshot = new Map<string, unknown>();
    for (const [key, value] of this.cache) {
      snapshot.set(key, value);
    }
    return snapshot;
  }

  /**
   * Run transaction
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Capture current state for rollback
    const snapshot = await this.captureSnapshot();
    
    try {
      return await this.adapter.transaction(fn);
    } catch (error) {
      // Rollback cache on failure
      this.cache = snapshot.entities;
      throw error;
    }
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }
}
