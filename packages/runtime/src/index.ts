/**
 * ISL Runtime
 * 
 * Execution engine for ISL behaviors.
 */

// Types
export {
  // Value types
  type IslPrimitive,
  type IslValue,
  type IslEntity,
  type IslResult,
  type IslError,
  
  // Type definitions
  type TypeDef,
  type PrimitiveTypeDef,
  type TypeConstraints,
  type EntityTypeDef,
  type FieldDef,
  type FieldModifier,
  type TypeRef,
  type EnumTypeDef,
  type ListTypeDef,
  type MapTypeDef,
  type OptionalTypeDef,
  
  // Behavior definitions
  type BehaviorDef,
  type OutputDef,
  type ErrorDef,
  type ConditionDef,
  type TemporalDef,
  
  // Entity definitions
  type InvariantDef,
  type LifecycleDef,
  type TransitionDef,
  
  // Domain
  type DomainDef,
  
  // Context
  type ExecutionContext,
  type EntityStore,
  type QueryFilter,
  type QueryOperator,
  
  // Events
  type RuntimeEventType,
  type RuntimeEvent,
  type EventHandler,
} from './types.js';

// Validation
export {
  validateType,
  validateEntity,
  validateConstraints,
  type ValidationResult,
  type ValidationError,
} from './validator.js';

// Executor
export {
  BehaviorExecutor,
  type BehaviorHandler,
  type BehaviorContext,
  type ExecutionOptions,
  type ExecutionResult,
} from './executor.js';

// Store
export {
  InMemoryStore,
  TransactionalStore,
} from './store.js';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Class
// ─────────────────────────────────────────────────────────────────────────────

import { BehaviorExecutor, type BehaviorHandler, type ExecutionOptions, type ExecutionResult } from './executor.js';
import { InMemoryStore } from './store.js';
import type { DomainDef, IslValue, EntityStore, EventHandler, RuntimeEventType } from './types.js';

/**
 * ISL Runtime instance
 */
export class IslRuntime {
  private executor: BehaviorExecutor;
  private store: EntityStore;
  private domain: DomainDef;

  constructor(domain: DomainDef, store?: EntityStore) {
    this.domain = domain;
    this.store = store ?? new InMemoryStore();
    this.executor = new BehaviorExecutor(domain, this.store);
  }

  /**
   * Register a behavior handler
   */
  register<TInput = Record<string, IslValue>, TOutput = IslValue>(
    behaviorName: string,
    handler: BehaviorHandler<TInput, TOutput>
  ): this {
    this.executor.register(behaviorName, handler);
    return this;
  }

  /**
   * Execute a behavior
   */
  async execute<TOutput = IslValue>(
    behaviorName: string,
    input: Record<string, IslValue>,
    options?: ExecutionOptions
  ): Promise<ExecutionResult<TOutput>> {
    return this.executor.execute(behaviorName, input, options);
  }

  /**
   * Subscribe to runtime events
   */
  on(event: RuntimeEventType | '*', handler: EventHandler): () => void {
    return this.executor.on(event, handler);
  }

  /**
   * Get the entity store
   */
  getStore(): EntityStore {
    return this.store;
  }

  /**
   * Get the domain definition
   */
  getDomain(): DomainDef {
    return this.domain;
  }
}

/**
 * Create a new ISL runtime
 */
export function createRuntime(domain: DomainDef, store?: EntityStore): IslRuntime {
  return new IslRuntime(domain, store);
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to build domain definitions
 */
export class DomainBuilder {
  private domain: DomainDef;

  constructor(name: string, version: string = '1.0.0') {
    this.domain = {
      name,
      version,
      types: new Map(),
      entities: new Map(),
      enums: new Map(),
      behaviors: new Map(),
    };
  }

  addEntity(entity: import('./types.js').EntityTypeDef): this {
    this.domain.entities.set(entity.name, entity);
    return this;
  }

  addEnum(enumDef: import('./types.js').EnumTypeDef): this {
    this.domain.enums.set(enumDef.name, enumDef);
    return this;
  }

  addBehavior(behavior: import('./types.js').BehaviorDef): this {
    this.domain.behaviors.set(behavior.name, behavior);
    return this;
  }

  addType(typeDef: import('./types.js').TypeDef): this {
    this.domain.types.set(typeDef.name, typeDef);
    return this;
  }

  build(): DomainDef {
    return this.domain;
  }
}

/**
 * Create a domain builder
 */
export function domain(name: string, version?: string): DomainBuilder {
  return new DomainBuilder(name, version);
}
