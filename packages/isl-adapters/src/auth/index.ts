/**
 * ISL Auth Domain Adapters
 * 
 * Provides offline-only adapters for evaluating auth domain expressions
 * in ISL verification. Supports two data sources:
 * 
 * 1. **Fixture Store**: In-memory data produced by test runtime
 * 2. **Trace Events**: State snapshots from proof bundle
 * 
 * All adapters guarantee NO network IO - everything is evaluated locally.
 * 
 * @module @isl-lang/adapters/auth
 * 
 * @example
 * ```typescript
 * // Fixture-based (for test runtime)
 * import { createFixtureAdapter, createTestUser } from '@isl-lang/adapters/auth';
 * 
 * const adapter = createFixtureAdapter({
 *   fixtures: {
 *     users: [createTestUser({ email: 'test@example.com', failed_attempts: 0 })],
 *     sessions: [],
 *   }
 * });
 * 
 * // Evaluate login.isl expressions
 * const user = adapter.lookupUserByEmail('test@example.com');
 * if (user !== 'unknown') {
 *   console.log(user.failed_attempts); // 0
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Trace-based (for proof bundle verification)
 * import { createTraceAdapter } from '@isl-lang/adapters/auth';
 * 
 * const adapter = createTraceAdapter({
 *   events: proofBundle.trace.events,
 *   stateMode: 'after',
 *   behavior: 'UserLogin',
 * });
 * 
 * // Verify postconditions from trace
 * const sessionExists = adapter.sessionExists(result.session.id);
 * ```
 */

// Types
export type {
  // Entity types
  UserEntity,
  SessionEntity,
  LoginAttemptEntity,
  UserStatus,
  TriState,
  
  // Store types
  AuthFixtureStore,
  AuthFixtureData,
  AuthStateSnapshot,
  AuthTraceEvent,
  
  // Adapter types
  AuthAdapter,
  LookupCriteria,
  
  // Options types
  FixtureAdapterOptions,
  TraceAdapterOptions,
} from './types.js';

// Fixture adapter
export {
  FixtureAuthAdapter,
  createFixtureAdapter,
  createTestUser,
  createTestSession,
} from './fixture-adapter.js';

// Trace adapter
export {
  TraceAuthAdapter,
  createTraceAdapter,
  createTestTraceEvent,
  createTestStateSnapshot,
} from './trace-adapter.js';

// ============================================================================
// CONVENIENCE: Combined Adapter Factory
// ============================================================================

import type { AuthAdapter, FixtureAdapterOptions, TraceAdapterOptions } from './types.js';
import { createFixtureAdapter } from './fixture-adapter.js';
import { createTraceAdapter } from './trace-adapter.js';

/**
 * Create an auth adapter from either fixtures or traces
 * 
 * Automatically detects the source type and creates the appropriate adapter.
 */
export function createAuthAdapter(
  options:
    | { type: 'fixture'; options: FixtureAdapterOptions }
    | { type: 'trace'; options: TraceAdapterOptions }
): AuthAdapter {
  switch (options.type) {
    case 'fixture':
      return createFixtureAdapter(options.options);
    case 'trace':
      return createTraceAdapter(options.options);
    default:
      throw new Error(`Unknown adapter type: ${(options as { type: string }).type}`);
  }
}

// ============================================================================
// VERIFICATION INTEGRATION
// ============================================================================

import type { TriState } from './types.js';

/**
 * Expression adapter wrapper for use with @isl-lang/verifier-runtime
 * 
 * Bridges the AuthAdapter interface to the ExpressionAdapter interface
 * expected by the evaluator.
 * 
 * @example
 * ```typescript
 * import { createFixtureAdapter, wrapForEvaluator } from '@isl-lang/adapters/auth';
 * import { evaluateExpression } from '@isl-lang/verifier-runtime';
 * 
 * const authAdapter = createFixtureAdapter({ fixtures: {...} });
 * const expressionAdapter = wrapForEvaluator(authAdapter);
 * 
 * // Use with evaluator
 * const result = evaluateExpression(expr, context, { adapter: expressionAdapter });
 * ```
 */
export function wrapForEvaluator(authAdapter: AuthAdapter): {
  is_valid: (value: unknown) => TriState;
  length: (value: unknown) => number | 'unknown';
  exists: (entityName: string, criteria: Record<string, unknown>) => TriState;
  lookup: (entityName: string, criteria: Record<string, unknown>) => unknown | 'unknown';
} {
  return {
    is_valid(value: unknown): TriState {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.length > 0;
      if (typeof value === 'number') return !isNaN(value) && isFinite(value);
      if (typeof value === 'boolean') return true;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },

    length(value: unknown): number | 'unknown' {
      if (value === null || value === undefined) return 'unknown';
      if (typeof value === 'string') return value.length;
      if (Array.isArray(value)) return value.length;
      return 'unknown';
    },

    exists(entityName: string, criteria: Record<string, unknown>): TriState {
      return authAdapter.exists(entityName, criteria);
    },

    lookup(entityName: string, criteria: Record<string, unknown>): unknown | 'unknown' {
      return authAdapter.lookup(entityName, criteria);
    },
  };
}

// ============================================================================
// OFFLINE GUARANTEE CHECK
// ============================================================================

/**
 * Assert that an adapter is offline-only (throws if not)
 * 
 * This is a runtime check that can be used to verify that
 * an adapter implementation doesn't perform network IO.
 */
export function assertOffline(adapter: AuthAdapter): void {
  if (!adapter.isOffline()) {
    throw new Error(
      'AuthAdapter must be offline-only. This adapter performs network IO.'
    );
  }
}
