/**
 * ISL Test Runtime
 * 
 * Provides runtime bindings for ISL generated tests:
 * - Entity proxies with exists(), lookup(), count() methods
 * - State capture for old() expressions  
 * - Test context management
 * 
 * @example
 * ```typescript
 * import { createTestContext } from '@isl-lang/test-runtime';
 * 
 * const ctx = createTestContext({ entities: ['User', 'Session'] });
 * const { User, Session } = ctx.entities;
 * 
 * beforeEach(() => ctx.reset());
 * 
 * it('creates user', async () => {
 *   const __old__ = ctx.captureState();
 *   const result = await CreateUser(input);
 *   expect(User.exists({ id: result.id })).toBe(true);
 * });
 * ```
 */

export { TestContext, createTestContext } from './context.js';
export { EntityProxy, createEntityProxy } from './entity-proxy.js';
export { StateCapture, captureState } from './state.js';
export { InMemoryEntityStore, createStore } from './store.js';
export type { 
  EntityStore, 
  EntityInstance, 
  TestContextConfig,
  StateSnapshot,
  QueryCriteria
} from './types.js';
