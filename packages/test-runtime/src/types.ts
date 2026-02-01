/**
 * Type definitions for ISL Test Runtime
 */

/**
 * An entity instance stored in the entity store
 */
export interface EntityInstance {
  __entity__: string;
  __id__: string;
  [key: string]: unknown;
}

/**
 * Criteria for querying entities
 */
export type QueryCriteria = Record<string, unknown>;

/**
 * Entity store interface - abstraction over actual data storage
 */
export interface EntityStore {
  /** Get all instances of an entity type */
  getAll(entityName: string): EntityInstance[];
  
  /** Check if entity matching criteria exists */
  exists(entityName: string, criteria?: QueryCriteria): boolean;
  
  /** Find a single entity by criteria */
  lookup(entityName: string, criteria: QueryCriteria): EntityInstance | undefined;
  
  /** Count entities matching criteria */
  count(entityName: string, criteria?: QueryCriteria): number;
  
  /** Create a new entity instance */
  create(entityName: string, data: Record<string, unknown>): EntityInstance;
  
  /** Update an existing entity */
  update(entityName: string, id: string, data: Record<string, unknown>): void;
  
  /** Delete an entity */
  delete(entityName: string, id: string): void;
  
  /** Take a snapshot of current state */
  snapshot(): StateSnapshot;
  
  /** Clear all data */
  clear(): void;
}

/**
 * Snapshot of entity store state at a point in time
 */
export interface StateSnapshot {
  entities: Map<string, Map<string, EntityInstance>>;
  timestamp: number;
}

/**
 * Configuration for test context
 */
export interface TestContextConfig {
  /** Custom entity store implementation */
  store?: EntityStore;
  /** Entity names to register */
  entities?: string[];
}
