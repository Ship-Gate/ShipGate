// ============================================================================
// ISL Expression Evaluator - Domain Adapters
// ============================================================================

// Auth domain adapter (fixture-based)
export {
  AuthDomainAdapter,
  createAuthAdapter,
  type AuthFixtures,
  type AuthAdapterOptions,
  type UserFixture,
  type SessionFixture,
  type ApiKeyFixture,
} from './auth-adapter.js';

// Trace-driven adapter
export {
  TraceDrivenAdapter,
  createTraceAdapter,
  createAdapterFromProofBundle,
  type TraceAdapterOptions,
} from './trace-adapter.js';

// Postcondition trace adapter (for before/after state comparison)
export {
  PostconditionTraceAdapter,
  createPostconditionTraceAdapter,
  createFromStateSnapshots,
  createFromFieldStates,
  type PostconditionTraceAdapterOptions,
} from './postcondition-trace-adapter.js';
