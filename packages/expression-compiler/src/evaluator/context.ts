/**
 * Evaluation Context Types
 *
 * Defines the runtime context for evaluating IR expressions.
 */

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

export interface EvaluationContext {
  /** Input values for the operation */
  input: Record<string, unknown>;
  /** Result value (for postconditions) */
  result?: unknown;
  /** Old state snapshot (for postconditions with old()) */
  oldState?: StateSnapshot;
  /** Variables in scope */
  variables: Map<string, unknown>;
  /** Entity store for entity operations */
  entities: EntityStore;
  /** Current timestamp */
  now: Date;
}

export interface StateSnapshot {
  /** Snapshot of entity state */
  entities: Map<string, Map<string, EntityInstance>>;
  /** Any other state values */
  values: Map<string, unknown>;
}

export interface EntityInstance {
  id: string;
  [key: string]: unknown;
}

// ============================================================================
// ENTITY STORE
// ============================================================================

export interface EntityStore {
  /** Check if entity exists with given criteria */
  exists(entityName: string, criteria?: Record<string, unknown>): boolean;
  /** Lookup an entity by criteria */
  lookup(entityName: string, criteria: Record<string, unknown>): EntityInstance | undefined;
  /** Count entities matching criteria */
  count(entityName: string, criteria?: Record<string, unknown>): number;
  /** Get all entities of a type */
  getAll(entityName: string): EntityInstance[];
}

// ============================================================================
// IN-MEMORY ENTITY STORE (for testing)
// ============================================================================

export class InMemoryEntityStore implements EntityStore {
  private data: Map<string, Map<string, EntityInstance>> = new Map();

  constructor(initialData?: Record<string, EntityInstance[]>) {
    if (initialData) {
      for (const [entityName, instances] of Object.entries(initialData)) {
        const entityMap = new Map<string, EntityInstance>();
        for (const instance of instances) {
          entityMap.set(instance.id, instance);
        }
        this.data.set(entityName, entityMap);
      }
    }
  }

  exists(entityName: string, criteria?: Record<string, unknown>): boolean {
    const entities = this.data.get(entityName);
    if (!entities) return false;
    if (!criteria) return entities.size > 0;

    return Array.from(entities.values()).some((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  lookup(entityName: string, criteria: Record<string, unknown>): EntityInstance | undefined {
    const entities = this.data.get(entityName);
    if (!entities) return undefined;

    return Array.from(entities.values()).find((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    );
  }

  count(entityName: string, criteria?: Record<string, unknown>): number {
    const entities = this.data.get(entityName);
    if (!entities) return 0;
    if (!criteria) return entities.size;

    return Array.from(entities.values()).filter((e) =>
      Object.entries(criteria).every(([k, v]) => e[k] === v)
    ).length;
  }

  getAll(entityName: string): EntityInstance[] {
    const entities = this.data.get(entityName);
    return entities ? Array.from(entities.values()) : [];
  }

  // Mutation methods for testing
  add(entityName: string, instance: EntityInstance): void {
    if (!this.data.has(entityName)) {
      this.data.set(entityName, new Map());
    }
    this.data.get(entityName)!.set(instance.id, instance);
  }

  remove(entityName: string, id: string): void {
    this.data.get(entityName)?.delete(id);
  }

  clear(): void {
    this.data.clear();
  }

  snapshot(): StateSnapshot {
    const entitySnapshot = new Map<string, Map<string, EntityInstance>>();
    for (const [name, entities] of this.data) {
      entitySnapshot.set(name, new Map(entities));
    }
    return { entities: entitySnapshot, values: new Map() };
  }
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

export interface ContextOptions {
  input?: Record<string, unknown>;
  result?: unknown;
  oldState?: StateSnapshot;
  variables?: Record<string, unknown>;
  entities?: Record<string, EntityInstance[]>;
  now?: Date;
}

export function createEvaluationContext(options: ContextOptions = {}): EvaluationContext {
  const variables = new Map<string, unknown>();
  if (options.variables) {
    for (const [k, v] of Object.entries(options.variables)) {
      variables.set(k, v);
    }
  }

  return {
    input: options.input ?? {},
    result: options.result,
    oldState: options.oldState,
    variables,
    entities: new InMemoryEntityStore(options.entities),
    now: options.now ?? new Date(),
  };
}

// ============================================================================
// EMPTY STORE (for contexts without entity access)
// ============================================================================

export const EMPTY_ENTITY_STORE: EntityStore = {
  exists: () => false,
  lookup: () => undefined,
  count: () => 0,
  getAll: () => [],
};
