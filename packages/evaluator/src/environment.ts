// ============================================================================
// ISL Expression Evaluator - Environment / Scope Management
// ============================================================================

import type {
  Environment,
  Binding,
  Value,
  EntityStore,
  EntityStoreSnapshot,
  EntityInstance,
} from './types.js';

// ============================================================================
// SCOPE IMPLEMENTATION
// ============================================================================

/**
 * Lexical scope implementation with parent chain lookup
 */
export class Scope implements Environment {
  private readonly scope: Map<string, Binding>;
  
  constructor(private readonly parent?: Scope) {
    this.scope = new Map();
  }

  /**
   * Get a variable's value, searching up the scope chain
   */
  get(name: string): Value {
    const binding = this.scope.get(name);
    if (binding !== undefined) {
      return binding.value;
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return undefined;
  }

  /**
   * Check if a variable exists in any scope
   */
  has(name: string): boolean {
    if (this.scope.has(name)) {
      return true;
    }
    if (this.parent) {
      return this.parent.has(name);
    }
    return false;
  }

  /**
   * Set a variable's value (must already exist)
   */
  set(name: string, value: Value): void {
    const binding = this.findBinding(name);
    if (binding) {
      if (!binding.mutable) {
        throw new Error(`Cannot assign to immutable variable: ${name}`);
      }
      binding.value = value;
    } else {
      // Define in current scope if not found
      this.define(name, value, true);
    }
  }

  /**
   * Define a new variable in the current scope
   */
  define(name: string, value: Value, mutable = false): void {
    this.scope.set(name, { name, value, mutable });
  }

  /**
   * Create a child scope
   */
  child(): Scope {
    return new Scope(this);
  }

  /**
   * Get all bindings from this scope (not including parent)
   */
  bindings(): Map<string, Binding> {
    return new Map(this.scope);
  }

  /**
   * Find a binding in the scope chain
   */
  private findBinding(name: string): Binding | undefined {
    const binding = this.scope.get(name);
    if (binding !== undefined) {
      return binding;
    }
    if (this.parent) {
      return this.parent.findBinding(name);
    }
    return undefined;
  }
}

// ============================================================================
// IN-MEMORY ENTITY STORE
// ============================================================================

/**
 * In-memory entity store implementation for testing and verification
 */
export class InMemoryEntityStore implements EntityStore {
  private entities: Map<string, Map<string, EntityInstance>>;
  private idCounters: Map<string, number>;

  constructor() {
    this.entities = new Map();
    this.idCounters = new Map();
  }

  /**
   * Get all instances of an entity type
   */
  getAll(entityName: string): EntityInstance[] {
    const instances = this.entities.get(entityName);
    return instances ? Array.from(instances.values()) : [];
  }

  /**
   * Check if any entity matching criteria exists
   */
  exists(entityName: string, criteria?: Record<string, unknown>): boolean {
    const instances = this.entities.get(entityName);
    if (!instances || instances.size === 0) {
      return false;
    }
    if (!criteria || Object.keys(criteria).length === 0) {
      return instances.size > 0;
    }
    return Array.from(instances.values()).some((instance) =>
      this.matchesCriteria(instance, criteria)
    );
  }

  /**
   * Lookup a single entity by criteria
   */
  lookup(
    entityName: string,
    criteria: Record<string, unknown>
  ): EntityInstance | undefined {
    const instances = this.entities.get(entityName);
    if (!instances) {
      return undefined;
    }
    return Array.from(instances.values()).find((instance) =>
      this.matchesCriteria(instance, criteria)
    );
  }

  /**
   * Count entities matching criteria
   */
  count(entityName: string, criteria?: Record<string, unknown>): number {
    const instances = this.entities.get(entityName);
    if (!instances) {
      return 0;
    }
    if (!criteria || Object.keys(criteria).length === 0) {
      return instances.size;
    }
    return Array.from(instances.values()).filter((instance) =>
      this.matchesCriteria(instance, criteria)
    ).length;
  }

  /**
   * Create a new entity instance
   */
  create(entityName: string, data: Record<string, unknown>): EntityInstance {
    if (!this.entities.has(entityName)) {
      this.entities.set(entityName, new Map());
    }

    const id = data['id'] as string ?? this.generateId(entityName);
    const instance: EntityInstance = {
      __entity__: entityName,
      __id__: id,
      ...data,
      id,
    };

    this.entities.get(entityName)!.set(id, instance);
    return instance;
  }

  /**
   * Update an entity instance
   */
  update(entityName: string, id: string, data: Record<string, unknown>): void {
    const instances = this.entities.get(entityName);
    if (!instances) {
      throw new Error(`Entity type not found: ${entityName}`);
    }
    const instance = instances.get(id);
    if (!instance) {
      throw new Error(`Entity instance not found: ${entityName}[${id}]`);
    }
    Object.assign(instance, data);
  }

  /**
   * Delete an entity instance
   */
  delete(entityName: string, id: string): void {
    const instances = this.entities.get(entityName);
    if (instances) {
      instances.delete(id);
    }
  }

  /**
   * Take a snapshot of current state
   */
  snapshot(): EntityStoreSnapshot {
    const snapshotEntities = new Map<string, Map<string, EntityInstance>>();
    
    for (const [entityName, instances] of this.entities) {
      const instancesCopy = new Map<string, EntityInstance>();
      for (const [id, instance] of instances) {
        // Deep clone the instance
        instancesCopy.set(id, this.deepClone(instance));
      }
      snapshotEntities.set(entityName, instancesCopy);
    }

    return {
      entities: snapshotEntities,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from a snapshot
   */
  restore(snapshot: EntityStoreSnapshot): void {
    this.entities = new Map();
    
    for (const [entityName, instances] of snapshot.entities) {
      const instancesCopy = new Map<string, EntityInstance>();
      for (const [id, instance] of instances) {
        instancesCopy.set(id, this.deepClone(instance));
      }
      this.entities.set(entityName, instancesCopy);
    }
  }

  /**
   * Clear all entities (useful for testing)
   */
  clear(): void {
    this.entities.clear();
    this.idCounters.clear();
  }

  /**
   * Seed with initial data
   */
  seed(entityName: string, instances: Record<string, unknown>[]): void {
    for (const data of instances) {
      this.create(entityName, data);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private matchesCriteria(
    instance: EntityInstance,
    criteria: Record<string, unknown>
  ): boolean {
    return Object.entries(criteria).every(([key, value]) => {
      const instanceValue = instance[key];
      return this.deepEqual(instanceValue, value);
    });
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    return false;
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as T;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }
    if (obj instanceof Map) {
      const clonedMap = new Map();
      for (const [key, value] of obj) {
        clonedMap.set(key, this.deepClone(value));
      }
      return clonedMap as T;
    }
    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      cloned[key] = this.deepClone((obj as Record<string, unknown>)[key]);
    }
    return cloned as T;
  }

  private generateId(entityName: string): string {
    const current = this.idCounters.get(entityName) ?? 0;
    this.idCounters.set(entityName, current + 1);
    return `${entityName.toLowerCase()}_${current + 1}`;
  }
}

// ============================================================================
// READ-ONLY SNAPSHOT STORE
// ============================================================================

/**
 * Read-only entity store wrapper for old() evaluation
 */
export class SnapshotEntityStore implements EntityStore {
  constructor(private readonly snapshot: EntityStoreSnapshot) {}

  getAll(entityName: string): EntityInstance[] {
    const entities = this.snapshot.entities.get(entityName);
    return entities ? Array.from(entities.values()) : [];
  }

  exists(entityName: string, criteria?: Record<string, unknown>): boolean {
    const entities = this.snapshot.entities.get(entityName);
    if (!entities || entities.size === 0) return false;
    if (!criteria) return entities.size > 0;
    return Array.from(entities.values()).some((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  lookup(
    entityName: string,
    criteria: Record<string, unknown>
  ): EntityInstance | undefined {
    const entities = this.snapshot.entities.get(entityName);
    if (!entities) return undefined;
    return Array.from(entities.values()).find((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  count(entityName: string, criteria?: Record<string, unknown>): number {
    const entities = this.snapshot.entities.get(entityName);
    if (!entities) return 0;
    if (!criteria) return entities.size;
    return Array.from(entities.values()).filter((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    ).length;
  }

  create(): EntityInstance {
    throw new Error('Cannot create entities in snapshot store');
  }

  update(): void {
    throw new Error('Cannot update entities in snapshot store');
  }

  delete(): void {
    throw new Error('Cannot delete entities in snapshot store');
  }

  snapshot(): EntityStoreSnapshot {
    return this.snapshot;
  }

  restore(): void {
    throw new Error('Cannot restore snapshot store');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new scope with optional parent
 */
export function createScope(parent?: Scope): Scope {
  return new Scope(parent);
}

/**
 * Create a new in-memory entity store
 */
export function createEntityStore(): InMemoryEntityStore {
  return new InMemoryEntityStore();
}

/**
 * Create a read-only store from a snapshot
 */
export function createSnapshotStore(
  snapshot: EntityStoreSnapshot
): SnapshotEntityStore {
  return new SnapshotEntityStore(snapshot);
}
