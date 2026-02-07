// ============================================================================
// ISL Property-Based Testing - v1.0.0
// ============================================================================
//
// Production-grade property-based testing for ISL specifications.
//
// Features:
// - Full type generators: Money, enums, nested structs, collections (List, Map, Set)
// - Precondition filtering (only valid inputs)
// - Postcondition and invariant verification with real expression evaluation
// - Constraint-aware shrinking for minimal failing cases
// - PII leak detection (never_logged / never_exposed invariants)
// - CLI with --seed, --num-tests, --format json
// - Deterministic runs via seed
// - Vitest integration
// ============================================================================

// Types
export type {
  PRNG,
  Generator,
  Property,
  BehaviorProperties,
  InputFieldSpec,
  FieldConstraints,
  PBTConfig,
  PBTReport,
  PBTStats,
  TestRun,
  LogCapture,
  ShrinkResult,
  ShrinkStep,
  PropertyViolation,
  PIIConfig,
  PBTJsonReport,
  CLIOptions,
} from './types.js';

export {
  DEFAULT_PBT_CONFIG,
  DEFAULT_PII_CONFIG,
} from './types.js';

// Random value generation
export {
  createPRNG,
  BaseGenerator,
  integer,
  float,
  boolean,
  string,
  email,
  password,
  uuid,
  timestamp,
  ipAddress,
  array,
  set,
  map,
  oneOf,
  constant,
  fromEnum,
  optional,
  record,
  fromConstraints,
  // Domain-specific generators
  money,
  moneyAmount,
  duration,
  durationMs,
} from './random.js';

// Property extraction
export {
  extractProperties,
  expressionToString,
  isPIIInvariant,
  getNeverLoggedFields,
  findBehavior,
  getSensitiveFields,
} from './property.js';

// Input generation
export {
  createInputGenerator,
} from './generator.js';

// Shrinking
export {
  shrinkInput,
  deltaDebug,
  shrinkEmail,
  shrinkPassword,
  shrinkIP,
  // Constraint-aware shrinkers
  shrinkConstrained,
  shrinkConstrainedString,
  shrinkMoney,
  shrinkMap,
  shrinkDuration,
} from './shrinker.js';

export type {
  ShrinkConstraints,
} from './shrinker.js';

// Test runner
export {
  runPBT,
  createPBTSuite,
  formatReport,
} from './runner.js';

export type {
  BehaviorImplementation,
  ExecutionResult,
} from './runner.js';

// Postcondition & Invariant evaluator
export {
  evaluatePostcondition,
  evaluateInvariant,
  evaluateAllProperties,
} from './postcondition-evaluator.js';

export type {
  EvalContext,
  EvalResult,
} from './postcondition-evaluator.js';

// PII checking
export {
  checkLogsForPII,
  sanitizeLogs,
  assertNoPII,
  createPIIChecker,
} from './pii-checker.js';

export type {
  PIICheckResult,
  PIIViolation,
} from './pii-checker.js';

// Login domain generators
export {
  validEmail,
  validPassword,
  createLoginInputGenerator,
  invalidEmail,
  invalidPassword,
  invalidLoginInput,
  validateLoginPreconditions,
  isValidEmailFormat,
  DEFAULT_LOGIN_PRECONDITIONS,
} from './login-generator.js';

export type {
  LoginInput,
  LoginPreconditions,
} from './login-generator.js';

// Precondition-aware shrinking
export {
  shrinkWithPreconditions,
  deltaDebugWithPreconditions,
  shrinkLoginInput,
  shrinkValidEmail,
  shrinkValidPassword,
  shrinkValidIP,
} from './precondition-shrinker.js';

export type {
  PreconditionChecker,
  PreconditionShrinkConfig,
  TracedShrinkResult,
  TracedShrinkStep,
} from './precondition-shrinker.js';

// CLI Integration
export {
  runPBTVerification,
  createPBTVerifier,
  formatPBTResult,
  createTracedImplementation,
} from './cli-integration.js';

export type {
  PBTVerifyOptions,
  PBTVerifyResult,
  PBTTrace,
} from './cli-integration.js';
