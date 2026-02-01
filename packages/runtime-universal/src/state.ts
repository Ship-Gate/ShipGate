/**
 * State Management for ISL Runtime
 * Immutable state with versioning and time-travel capabilities
 */

import { StateSnapshot, EntityState, StateChange } from './types';

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  /** Maximum history size */
  maxHistorySize: number;
  /** Enable automatic snapshots */
  autoSnapshot: boolean;
  /** Snapshot interval (number of changes) */
  snapshotInterval: number;
}

/**
 * Default state manager configuration
 */
const DEFAULT_CONFIG: StateManagerConfig = {
  maxHistorySize: 1000,
  autoSnapshot: true,
  snapshotInterval: 100,
};

/**
 * State manager with versioning and time-travel support
 */
export class StateManager {
  private config: StateManagerConfig;
  private entities: Map<string, Map<string, EntityState>> = new Map();
  private history: StateChange[] = [];
  private snapshots: Map<number, StateSnapshot> = new Map();
  private version = 0;
  private changesSinceSnapshot = 0;

  constructor(config: Partial<StateManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.createSnapshot();
  }

  /**
   * Get current state snapshot
   */
  getSnapshot(): StateSnapshot {
    return {
      version: this.version,
      timestamp: Date.now(),
      entities: this.cloneEntities(),
      checksum: this.calculateChecksum(),
    };
  }

  /**
   * Set state from snapshot
   */
  setState(snapshot: StateSnapshot): void {
    this.entities = snapshot.entities;
    this.version = snapshot.version;
    this.createSnapshot();
  }

  /**
   * Get entity by type and ID
   */
  getEntity(type: string, id: string): EntityState | undefined {
    return this.entities.get(type)?.get(id);
  }

  /**
   * Query entities by type with optional predicate
   */
  queryEntities(
    type: string,
    predicate?: (entity: EntityState) => boolean
  ): EntityState[] {
    const typeEntities = this.entities.get(type);
    if (!typeEntities) return [];

    const entities = Array.from(typeEntities.values());
    return predicate ? entities.filter(predicate) : entities;
  }

  /**
   * Create a new entity
   */
  createEntity(type: string, data: Record<string, unknown>, id?: string): EntityState {
    const entityId = id ?? this.generateId();
    const now = Date.now();

    const entity: EntityState = {
      id: entityId,
      type,
      data,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    if (!this.entities.has(type)) {
      this.entities.set(type, new Map());
    }
    this.entities.get(type)!.set(entityId, entity);

    this.recordChange({
      entityType: type,
      entityId,
      operation: 'create',
      after: data,
      timestamp: now,
    });

    return entity;
  }

  /**
   * Update an entity
   */
  updateEntity(
    type: string,
    id: string,
    updates: Record<string, unknown>
  ): EntityState | undefined {
    const entity = this.getEntity(type, id);
    if (!entity) return undefined;

    const before = { ...entity.data };
    const now = Date.now();

    const updated: EntityState = {
      ...entity,
      data: { ...entity.data, ...updates },
      version: entity.version + 1,
      updatedAt: now,
    };

    this.entities.get(type)!.set(id, updated);

    this.recordChange({
      entityType: type,
      entityId: id,
      operation: 'update',
      before,
      after: updated.data,
      timestamp: now,
    });

    return updated;
  }

  /**
   * Delete an entity
   */
  deleteEntity(type: string, id: string): boolean {
    const entity = this.getEntity(type, id);
    if (!entity) return false;

    this.entities.get(type)!.delete(id);

    this.recordChange({
      entityType: type,
      entityId: id,
      operation: 'delete',
      before: entity.data,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Get changes since a specific version
   */
  getChangesSince(version: number): StateChange[] {
    const versionIndex = this.history.findIndex(
      (_, i) => this.getVersionAtIndex(i) > version
    );
    
    if (versionIndex === -1) return [];
    return this.history.slice(versionIndex);
  }

  /**
   * Rollback to a specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    // Find the closest snapshot
    let closestSnapshot: StateSnapshot | undefined;
    let closestVersion = 0;

    for (const [version, snapshot] of this.snapshots) {
      if (version <= targetVersion && version > closestVersion) {
        closestSnapshot = snapshot;
        closestVersion = version;
      }
    }

    if (closestSnapshot) {
      this.entities = closestSnapshot.entities;
      this.version = closestSnapshot.version;
    } else {
      // Reset to initial state
      this.entities = new Map();
      this.version = 0;
    }

    // Replay changes up to target version
    const changesToReplay = this.history.filter(
      (_, i) => {
        const changeVersion = this.getVersionAtIndex(i);
        return changeVersion > closestVersion && changeVersion <= targetVersion;
      }
    );

    for (const change of changesToReplay) {
      this.applyChange(change);
    }

    // Trim history after target version
    this.history = this.history.filter(
      (_, i) => this.getVersionAtIndex(i) <= targetVersion
    );
  }

  /**
   * Time travel to a specific point
   */
  async timeTravel(timestamp: number): Promise<StateSnapshot> {
    const changes = this.history.filter((c) => c.timestamp <= timestamp);
    
    // Create a new state manager to replay
    const tempManager = new StateManager();
    
    for (const change of changes) {
      tempManager.applyChange(change);
    }

    return tempManager.getSnapshot();
  }

  /**
   * Get entity history
   */
  getEntityHistory(type: string, id: string): StateChange[] {
    return this.history.filter(
      (c) => c.entityType === type && c.entityId === id
    );
  }

  /**
   * Get diff between two versions
   */
  getDiff(fromVersion: number, toVersion: number): StateDiff {
    const changes = this.history.filter((_, i) => {
      const v = this.getVersionAtIndex(i);
      return v > fromVersion && v <= toVersion;
    });

    const created: EntityState[] = [];
    const updated: Array<{ before: EntityState; after: EntityState }> = [];
    const deleted: EntityState[] = [];

    // Analyze changes
    const entityChanges = new Map<string, StateChange[]>();
    
    for (const change of changes) {
      const key = `${change.entityType}:${change.entityId}`;
      if (!entityChanges.has(key)) {
        entityChanges.set(key, []);
      }
      entityChanges.get(key)!.push(change);
    }

    for (const [key, entityHistory] of entityChanges) {
      const first = entityHistory[0]!;
      const last = entityHistory[entityHistory.length - 1]!;

      if (first.operation === 'create' && last.operation !== 'delete') {
        created.push({
          id: first.entityId,
          type: first.entityType,
          data: last.after ?? {},
          version: entityHistory.length,
          createdAt: first.timestamp,
          updatedAt: last.timestamp,
        });
      } else if (last.operation === 'delete') {
        deleted.push({
          id: first.entityId,
          type: first.entityType,
          data: first.before ?? {},
          version: 0,
          createdAt: 0,
          updatedAt: first.timestamp,
        });
      } else if (first.before && last.after) {
        updated.push({
          before: {
            id: first.entityId,
            type: first.entityType,
            data: first.before,
            version: 0,
            createdAt: 0,
            updatedAt: first.timestamp,
          },
          after: {
            id: last.entityId,
            type: last.entityType,
            data: last.after,
            version: entityHistory.length,
            createdAt: 0,
            updatedAt: last.timestamp,
          },
        });
      }
    }

    return { created, updated, deleted };
  }

  /**
   * Export state to JSON
   */
  export(): string {
    return JSON.stringify({
      version: this.version,
      entities: Array.from(this.entities.entries()).map(([type, entities]) => [
        type,
        Array.from(entities.values()),
      ]),
      history: this.history,
    });
  }

  /**
   * Import state from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json);
    
    this.version = data.version;
    this.entities = new Map();
    
    for (const [type, entities] of data.entities) {
      this.entities.set(type, new Map(entities.map((e: EntityState) => [e.id, e])));
    }
    
    this.history = data.history;
    this.createSnapshot();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private recordChange(change: StateChange): void {
    this.history.push(change);
    this.version++;
    this.changesSinceSnapshot++;

    // Trim history if too large
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    // Auto snapshot
    if (
      this.config.autoSnapshot &&
      this.changesSinceSnapshot >= this.config.snapshotInterval
    ) {
      this.createSnapshot();
    }
  }

  private applyChange(change: StateChange): void {
    switch (change.operation) {
      case 'create':
        if (change.after) {
          this.createEntity(change.entityType, change.after, change.entityId);
        }
        break;
      case 'update':
        if (change.after) {
          this.updateEntity(change.entityType, change.entityId, change.after);
        }
        break;
      case 'delete':
        this.deleteEntity(change.entityType, change.entityId);
        break;
    }
  }

  private createSnapshot(): void {
    this.snapshots.set(this.version, this.getSnapshot());
    this.changesSinceSnapshot = 0;

    // Limit snapshots
    const maxSnapshots = Math.floor(this.config.maxHistorySize / this.config.snapshotInterval);
    if (this.snapshots.size > maxSnapshots) {
      const versions = Array.from(this.snapshots.keys()).sort((a, b) => a - b);
      for (let i = 0; i < versions.length - maxSnapshots; i++) {
        this.snapshots.delete(versions[i]!);
      }
    }
  }

  private cloneEntities(): Map<string, EntityState> {
    const clone = new Map<string, EntityState>();
    for (const [type, entities] of this.entities) {
      for (const [id, entity] of entities) {
        clone.set(`${type}:${id}`, { ...entity, data: { ...entity.data } });
      }
    }
    return clone;
  }

  private calculateChecksum(): string {
    const data = JSON.stringify(Array.from(this.entities.entries()));
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private getVersionAtIndex(index: number): number {
    // Each change increments version by 1, starting from initial version
    const initialVersion = this.version - this.history.length;
    return initialVersion + index + 1;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * State diff result
 */
export interface StateDiff {
  created: EntityState[];
  updated: Array<{ before: EntityState; after: EntityState }>;
  deleted: EntityState[];
}

/**
 * Create a new state manager
 */
export function createStateManager(config?: Partial<StateManagerConfig>): StateManager {
  return new StateManager(config);
}

/**
 * Immutable state operations
 */
export const ImmutableOps = {
  /**
   * Set a value at a path
   */
  setIn<T extends Record<string, unknown>>(
    obj: T,
    path: string[],
    value: unknown
  ): T {
    if (path.length === 0) return value as T;

    const [head, ...tail] = path;
    return {
      ...obj,
      [head!]: this.setIn(
        (obj[head!] as Record<string, unknown>) ?? {},
        tail,
        value
      ),
    } as T;
  },

  /**
   * Update a value at a path
   */
  updateIn<T extends Record<string, unknown>>(
    obj: T,
    path: string[],
    updater: (value: unknown) => unknown
  ): T {
    const current = this.getIn(obj, path);
    return this.setIn(obj, path, updater(current));
  },

  /**
   * Get a value at a path
   */
  getIn(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  },

  /**
   * Delete a value at a path
   */
  deleteIn<T extends Record<string, unknown>>(obj: T, path: string[]): T {
    if (path.length === 0) return {} as T;
    if (path.length === 1) {
      const { [path[0]!]: _, ...rest } = obj;
      return rest as T;
    }

    const [head, ...tail] = path;
    return {
      ...obj,
      [head!]: this.deleteIn(
        (obj[head!] as Record<string, unknown>) ?? {},
        tail
      ),
    } as T;
  },

  /**
   * Merge objects deeply
   */
  merge<T extends Record<string, unknown>>(...objects: Partial<T>[]): T {
    return objects.reduce((acc, obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          typeof acc[key] === 'object' &&
          acc[key] !== null
        ) {
          acc[key] = this.merge(
            acc[key] as Record<string, unknown>,
            value as Record<string, unknown>
          ) as T[keyof T];
        } else {
          acc[key] = value as T[keyof T];
        }
      }
      return acc;
    }, {} as T);
  },
};
