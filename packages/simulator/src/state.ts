/**
 * State Management
 * 
 * Manages simulator state with immutable updates and snapshots.
 */

import type {
  SimulatorState,
  EntityStore,
  EntityInstance,
  EntityDefinition,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// State Manager
// ─────────────────────────────────────────────────────────────────────────────

export class StateManager {
  private state: SimulatorState;
  private entityDefinitions: Map<string, EntityDefinition>;
  private history: SimulatorState[] = [];
  private maxHistory: number;

  constructor(
    entityDefinitions: EntityDefinition[],
    initialState?: Record<string, unknown[]>,
    maxHistory: number = 100
  ) {
    this.entityDefinitions = new Map(
      entityDefinitions.map(e => [e.name, e])
    );
    this.maxHistory = maxHistory;
    this.state = this.createInitialState(initialState);
  }

  /**
   * Create initial state from definitions and optional initial data
   */
  private createInitialState(initialData?: Record<string, unknown[]>): SimulatorState {
    const entities: Record<string, EntityStore> = {};

    // Initialize stores for all entity types
    for (const [name] of this.entityDefinitions) {
      entities[name] = {
        items: {},
        count: 0,
      };
    }

    // Populate with initial data
    if (initialData) {
      for (const [entityType, items] of Object.entries(initialData)) {
        if (entities[entityType]) {
          for (const item of items) {
            const id = (item as Record<string, unknown>).id as string || generateId();
            const now = new Date();
            entities[entityType].items[id] = {
              id,
              data: item as Record<string, unknown>,
              createdAt: now,
              updatedAt: now,
              version: 1,
            };
            entities[entityType].count++;
          }
        }
      }
    }

    return {
      entities,
      custom: {},
      version: 1,
    };
  }

  /**
   * Get current state (read-only snapshot)
   */
  getState(): Readonly<SimulatorState> {
    return this.state;
  }

  /**
   * Get a deep clone of current state
   */
  snapshot(): SimulatorState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get all entities of a type
   */
  getEntities<T = Record<string, unknown>>(entityType: string): T[] {
    const store = this.state.entities[entityType];
    if (!store) return [];
    return Object.values(store.items).map(item => ({
      id: item.id,
      ...item.data,
    })) as T[];
  }

  /**
   * Get entity by ID
   */
  getEntity<T = Record<string, unknown>>(entityType: string, id: string): T | null {
    const store = this.state.entities[entityType];
    if (!store) return null;
    const item = store.items[id];
    if (!item) return null;
    return { id: item.id, ...item.data } as T;
  }

  /**
   * Find entities matching a predicate
   */
  findEntities<T = Record<string, unknown>>(
    entityType: string,
    predicate: (entity: T) => boolean
  ): T[] {
    return this.getEntities<T>(entityType).filter(predicate);
  }

  /**
   * Check if entity exists
   */
  exists(entityType: string, id: string): boolean {
    const store = this.state.entities[entityType];
    return store ? id in store.items : false;
  }

  /**
   * Get entity count
   */
  count(entityType: string): number {
    const store = this.state.entities[entityType];
    return store ? store.count : 0;
  }

  /**
   * Create a new entity
   */
  createEntity<T extends Record<string, unknown>>(
    entityType: string,
    data: T
  ): T & { id: string } {
    this.saveHistory();

    const definition = this.entityDefinitions.get(entityType);
    if (!definition) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const id = (data.id as string) || generateId();
    const now = new Date();

    // Apply default values from definition
    const entityData: Record<string, unknown> = { ...data };
    for (const field of definition.fields) {
      if (!(field.name in entityData) && field.defaultValue !== undefined) {
        entityData[field.name] = field.defaultValue;
      }
    }

    // Handle immutable timestamp fields
    if (!entityData.created_at && hasField(definition, 'created_at')) {
      entityData.created_at = now;
    }
    if (!entityData.updated_at && hasField(definition, 'updated_at')) {
      entityData.updated_at = now;
    }

    const instance: EntityInstance = {
      id,
      data: entityData,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Update state immutably
    this.state = {
      ...this.state,
      entities: {
        ...this.state.entities,
        [entityType]: {
          items: {
            ...this.state.entities[entityType]?.items,
            [id]: instance,
          },
          count: (this.state.entities[entityType]?.count || 0) + 1,
        },
      },
      version: this.state.version + 1,
    };

    return { id, ...entityData } as T & { id: string };
  }

  /**
   * Update an entity
   */
  updateEntity<T extends Record<string, unknown>>(
    entityType: string,
    id: string,
    data: Partial<T>
  ): T {
    this.saveHistory();

    const store = this.state.entities[entityType];
    if (!store || !store.items[id]) {
      throw new Error(`Entity not found: ${entityType}#${id}`);
    }

    const definition = this.entityDefinitions.get(entityType);
    const existing = store.items[id];
    const now = new Date();

    // Filter out immutable fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const field = definition?.fields.find(f => f.name === key);
      if (field && field.modifiers.includes('immutable')) {
        continue; // Skip immutable fields
      }
      updates[key] = value;
    }

    // Update timestamp
    if (hasField(definition, 'updated_at')) {
      updates.updated_at = now;
    }

    const updatedInstance: EntityInstance = {
      ...existing,
      data: { ...existing.data, ...updates },
      updatedAt: now,
      version: existing.version + 1,
    };

    this.state = {
      ...this.state,
      entities: {
        ...this.state.entities,
        [entityType]: {
          ...store,
          items: {
            ...store.items,
            [id]: updatedInstance,
          },
        },
      },
      version: this.state.version + 1,
    };

    return { id, ...updatedInstance.data } as unknown as T;
  }

  /**
   * Delete an entity
   */
  deleteEntity(entityType: string, id: string): boolean {
    this.saveHistory();

    const store = this.state.entities[entityType];
    if (!store || !store.items[id]) {
      return false;
    }

    const { [id]: _, ...remaining } = store.items;

    this.state = {
      ...this.state,
      entities: {
        ...this.state.entities,
        [entityType]: {
          items: remaining,
          count: store.count - 1,
        },
      },
      version: this.state.version + 1,
    };

    return true;
  }

  /**
   * Set custom state value
   */
  setCustom(key: string, value: unknown): void {
    this.saveHistory();
    this.state = {
      ...this.state,
      custom: {
        ...this.state.custom,
        [key]: value,
      },
      version: this.state.version + 1,
    };
  }

  /**
   * Get custom state value
   */
  getCustom<T = unknown>(key: string): T | undefined {
    return this.state.custom[key] as T | undefined;
  }

  /**
   * Reset state to initial
   */
  reset(initialState?: Record<string, unknown[]>): void {
    this.history = [];
    this.state = this.createInitialState(initialState);
  }

  /**
   * Restore state from snapshot
   */
  restore(snapshot: SimulatorState): void {
    this.saveHistory();
    this.state = JSON.parse(JSON.stringify(snapshot));
  }

  /**
   * Undo last change
   */
  undo(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  /**
   * Get history length
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Save current state to history
   */
  private saveHistory(): void {
    this.history.push(this.snapshot());
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function hasField(definition: EntityDefinition | undefined, fieldName: string): boolean {
  return definition?.fields.some(f => f.name === fieldName) ?? false;
}

export { generateId };
