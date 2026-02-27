/**
 * Test Context
 * 
 * Main entry point for ISL generated tests - provides entity bindings
 */

import type { EntityStore, TestContextConfig, StateSnapshot } from './types.js';
import { EntityProxy, createEntityProxy } from './entity-proxy.js';
import { StateCapture, captureState } from './state.js';
import { InMemoryEntityStore, createStore } from './store.js';

/**
 * Test context that provides entity bindings for generated tests
 * 
 * Usage in generated tests:
 * ```typescript
 * import { createTestContext } from '@isl-lang/test-runtime';
 * 
 * describe('CreateUser', () => {
 *   const ctx = createTestContext({ entities: ['User', 'Session'] });
 *   const { User, Session } = ctx.entities;
 *   
 *   beforeEach(() => ctx.reset());
 *   
 *   it('success implies User.exists(result.id)', async () => {
 *     const __old__ = ctx.captureState();
 *     const result = await CreateUser(input);
 *     expect(User.exists({ id: result.id })).toBe(true);
 *   });
 * });
 * ```
 */
export class TestContext {
  private readonly store: EntityStore;
  private readonly entityProxies = new Map<string, EntityProxy>();
  
  /**
   * Entity proxies as an object for destructuring
   */
  public readonly entities: Record<string, EntityProxy>;

  constructor(config: TestContextConfig = {}) {
    this.store = config.store ?? createStore();
    this.entities = {};
    
    // Register entities
    if (config.entities) {
      for (const entityName of config.entities) {
        this.registerEntity(entityName);
      }
    }
  }

  /**
   * Register an entity type and create its proxy
   */
  registerEntity(entityName: string): EntityProxy {
    if (!this.entityProxies.has(entityName)) {
      const proxy = createEntityProxy(entityName, this.store);
      this.entityProxies.set(entityName, proxy);
      this.entities[entityName] = proxy;
    }
    return this.entityProxies.get(entityName)!;
  }

  /**
   * Get an entity proxy by name
   */
  entity(entityName: string): EntityProxy {
    if (!this.entityProxies.has(entityName)) {
      return this.registerEntity(entityName);
    }
    return this.entityProxies.get(entityName)!;
  }

  /**
   * Capture current state for old() expressions
   */
  captureState(): StateCapture {
    return captureState(this.store);
  }

  /**
   * Reset store to empty state (call in beforeEach)
   */
  reset(): void {
    this.store.clear();
  }

  /**
   * Seed entity data for tests
   */
  seed(entityName: string, instances: Record<string, unknown>[]): void {
    const store = this.store as InMemoryEntityStore;
    if ('seed' in store) {
      store.seed(entityName, instances);
    } else {
      for (const data of instances) {
        this.store.create(entityName, data);
      }
    }
  }

  /**
   * Get current state snapshot
   */
  getSnapshot(): StateSnapshot {
    return this.store.snapshot();
  }

  /**
   * Get the underlying store (for advanced use)
   */
  getStore(): EntityStore {
    return this.store;
  }
}

/**
 * Create a test context with entity bindings
 * 
 * @param config - Configuration with entity names and optional custom store
 * @returns TestContext with entity proxies
 * 
 * @example
 * ```typescript
 * const ctx = createTestContext({ entities: ['User', 'Session'] });
 * const { User, Session } = ctx.entities;
 * 
 * // In tests:
 * expect(User.exists({ id: result.id })).toBe(true);
 * ```
 */
export function createTestContext(config?: TestContextConfig): TestContext {
  return new TestContext(config);
}
