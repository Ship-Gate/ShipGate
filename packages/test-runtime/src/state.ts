/**
 * State Capture
 * 
 * Provides state snapshots for old() expressions in postconditions
 */

import type { EntityStore, StateSnapshot, EntityInstance, QueryCriteria } from './types.js';

/**
 * Captured state for old() evaluation
 */
export class StateCapture {
  private readonly _snapshot: StateSnapshot;
  private readonly entityProxies = new Map<string, OldEntityProxy>();

  constructor(store: EntityStore) {
    this._snapshot = store.snapshot();
  }

  /**
   * Get the snapshot timestamp
   */
  get timestamp(): number {
    return this._snapshot.timestamp;
  }

  /**
   * Get an entity proxy for old state
   */
  entity(entityName: string): OldEntityProxy {
    if (!this.entityProxies.has(entityName)) {
      this.entityProxies.set(entityName, new OldEntityProxy(entityName, this._snapshot));
    }
    return this.entityProxies.get(entityName)!;
  }

  /**
   * Raw snapshot access
   */
  get snapshot(): StateSnapshot {
    return this._snapshot;
  }
}

/**
 * Read-only entity proxy for old() state
 */
class OldEntityProxy {
  constructor(
    private readonly entityName: string,
    private readonly snapshot: StateSnapshot
  ) {}

  exists(criteria?: QueryCriteria): boolean {
    const entities = this.snapshot.entities.get(this.entityName);
    if (!entities || entities.size === 0) return false;
    if (!criteria || Object.keys(criteria).length === 0) return entities.size > 0;
    return Array.from(entities.values()).some((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  lookup(criteria: QueryCriteria): EntityInstance | undefined {
    const entities = this.snapshot.entities.get(this.entityName);
    if (!entities) return undefined;
    return Array.from(entities.values()).find((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  count(criteria?: QueryCriteria): number {
    const entities = this.snapshot.entities.get(this.entityName);
    if (!entities) return 0;
    if (!criteria || Object.keys(criteria).length === 0) return entities.size;
    return Array.from(entities.values()).filter((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    ).length;
  }

  getAll(): EntityInstance[] {
    const entities = this.snapshot.entities.get(this.entityName);
    return entities ? Array.from(entities.values()) : [];
  }
}

/**
 * Capture current state for old() evaluation
 */
export function captureState(store: EntityStore): StateCapture {
  return new StateCapture(store);
}
