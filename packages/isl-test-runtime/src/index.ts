/**
 * ISL Test Runtime
 * 
 * Runtime utilities for generating and running executable tests
 * that emit verification traces.
 * 
 * Key Features:
 * - Login test harness covering SUCCESS, INVALID_CREDENTIALS, USER_LOCKED paths
 * - Trace emission in isl-trace-format
 * - Fixture store for test adapters
 * - Integration with isl verify command
 * 
 * @example
 * ```typescript
 * import { runLoginTests, formatForISLVerify } from '@isl-lang/test-runtime';
 * 
 * const summary = await runLoginTests({ verbose: true });
 * const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);
 * 
 * console.log(`Tests: ${verifyOutput.summary}`);
 * console.log(`Verdict: ${verifyOutput.proofBundle.verdict}`);
 * ```
 */

// NOTE: Legacy exports (trace-emitter.js, test-generator.js) are disabled
// due to workspace dependency issues. Use the login harness exports instead.

// Login test harness
export {
  // Trace Types (from isl-trace-format)
  type Trace,
  type TraceEvent,
  type TraceEventKind,
  type TraceMetadata,
  // Login Types
  type User,
  type Session,
  type LoginInput,
  type LoginResult,
  type LoginError,
  type TestCase,
  type TestResult,
  type TestSummary,
  type UserStatus,
  type LoginHandlerConfig,
  type LoginTestHarnessConfig,
  // Classes
  FixtureStore,
  LoginTestHarness,
  // Functions
  createLoginTestHarness,
  runLoginTests,
  runLoginTestsWithTraces,
  createLoginHandler,
  hashPassword,
  verifyPassword,
  LOGIN_TEST_CASES,
} from './login-harness.js';

// Fixture adapters
export {
  // Types
  type FixtureSnapshot,
  type VerificationResult,
  type VerificationEvidence,
  type CheckEvidence,
  type ProofBundle,
  type ISLVerifyInput,
  type ISLVerifyOutput,
  type VitestAdapterConfig,
  // Classes
  FixtureStoreAdapter,
  VitestAdapter,
  // Functions
  createFixtureStoreAdapter,
  createVitestAdapter,
  formatForISLVerify,
  assertTestsExecuted,
} from './fixture-adapter.js';
