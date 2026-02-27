/**
 * Entity Proxy
 * 
 * Provides the runtime binding for ISL entity operations like:
 * - User.exists({ id: '123' })
 * - User.lookup({ email: 'test@example.com' })
 * - User.count()
 */

import type { EntityStore, EntityInstance, QueryCriteria } from './types.js';

/**
 * Proxy that provides entity operations for generated tests
 */
export class EntityProxy {
  constructor(
    private readonly entityName: string,
    private readonly store: EntityStore
  ) {}

  /**
   * Check if any entity matching the criteria exists
   * 
   * Usage in generated code:
   *   User.exists({ id: result.id })
   *   User.exists() // any user exists
   */
  exists(criteria?: QueryCriteria): boolean {
    return this.store.exists(this.entityName, criteria);
  }

  /**
   * Find a single entity by criteria
   * 
   * Usage in generated code:
   *   User.lookup({ email: input.email })
   */
  lookup(criteria: QueryCriteria): EntityInstance | undefined {
    return this.store.lookup(this.entityName, criteria);
  }

  /**
   * Count entities matching criteria
   * 
   * Usage in generated code:
   *   User.count()
   *   User.count({ status: 'active' })
   */
  count(criteria?: QueryCriteria): number {
    return this.store.count(this.entityName, criteria);
  }

  /**
   * Get all entities of this type
   * 
   * Usage in generated code:
   *   User.getAll()
   */
  getAll(): EntityInstance[] {
    return this.store.getAll(this.entityName);
  }

  /**
   * Create a new entity (for test setup)
   * 
   * Usage in generated code:
   *   User.create({ email: 'test@example.com', name: 'Test' })
   */
  create(data: Record<string, unknown>): EntityInstance {
    return this.store.create(this.entityName, data);
  }

  /**
   * Update an entity (for test setup)
   */
  update(id: string, data: Record<string, unknown>): void {
    this.store.update(this.entityName, id, data);
  }

  /**
   * Delete an entity (for test setup)
   */
  delete(id: string): void {
    this.store.delete(this.entityName, id);
  }
}

/**
 * Create an entity proxy
 */
export function createEntityProxy(entityName: string, store: EntityStore): EntityProxy {
  return new EntityProxy(entityName, store);
}
