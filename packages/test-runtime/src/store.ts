/**
 * In-Memory Entity Store
 * 
 * Default implementation of EntityStore for testing
 */

import type { EntityStore, EntityInstance, QueryCriteria, StateSnapshot } from './types.js';

/**
 * In-memory entity store implementation
 */
export class InMemoryEntityStore implements EntityStore {
  private entities = new Map<string, Map<string, EntityInstance>>();
  private idCounters = new Map<string, number>();

  getAll(entityName: string): EntityInstance[] {
    const instances = this.entities.get(entityName);
    return instances ? Array.from(instances.values()) : [];
  }

  exists(entityName: string, criteria?: QueryCriteria): boolean {
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

  lookup(entityName: string, criteria: QueryCriteria): EntityInstance | undefined {
    const instances = this.entities.get(entityName);
    if (!instances) {
      return undefined;
    }
    return Array.from(instances.values()).find((instance) =>
      this.matchesCriteria(instance, criteria)
    );
  }

  count(entityName: string, criteria?: QueryCriteria): number {
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

  create(entityName: string, data: Record<string, unknown>): EntityInstance {
    if (!this.entities.has(entityName)) {
      this.entities.set(entityName, new Map());
    }

    const id = (data['id'] as string) ?? this.generateId(entityName);
    const instance: EntityInstance = {
      __entity__: entityName,
      __id__: id,
      id,
      ...data,
    };

    this.entities.get(entityName)!.set(id, instance);
    return instance;
  }

  update(entityName: string, id: string, data: Record<string, unknown>): void {
    const instances = this.entities.get(entityName);
    if (!instances) {
      throw new Error(`Entity type not found: ${entityName}`);
    }
    const instance = instances.get(id);
    if (!instance) {
      throw new Error(`Entity not found: ${entityName}[${id}]`);
    }
    Object.assign(instance, data);
  }

  delete(entityName: string, id: string): void {
    const instances = this.entities.get(entityName);
    if (instances) {
      instances.delete(id);
    }
  }

  snapshot(): StateSnapshot {
    const snapshotEntities = new Map<string, Map<string, EntityInstance>>();
    
    for (const [entityName, instances] of this.entities) {
      const instancesCopy = new Map<string, EntityInstance>();
      for (const [id, instance] of instances) {
        instancesCopy.set(id, this.deepClone(instance));
      }
      snapshotEntities.set(entityName, instancesCopy);
    }

    return {
      entities: snapshotEntities,
      timestamp: Date.now(),
    };
  }

  clear(): void {
    this.entities.clear();
    this.idCounters.clear();
  }

  /**
   * Seed with initial test data
   */
  seed(entityName: string, instances: Record<string, unknown>[]): void {
    for (const data of instances) {
      this.create(entityName, data);
    }
  }

  private matchesCriteria(instance: EntityInstance, criteria: QueryCriteria): boolean {
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
      const cloned = new Map();
      for (const [key, value] of obj) {
        cloned.set(key, this.deepClone(value));
      }
      return cloned as T;
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
    return `${entityName.toLowerCase()}_${String(current + 1).padStart(6, '0')}`;
  }
}

/**
 * Create a new in-memory entity store
 */
export function createStore(): InMemoryEntityStore {
  return new InMemoryEntityStore();
}
