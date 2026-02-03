// ============================================================================
// ISL Property-Based Testing
// ============================================================================
// 
// Generate random inputs satisfying ISL preconditions and verify postconditions.
//
// Features:
// - Type-aware random input generation
// - Precondition filtering (only valid inputs)
// - Postcondition and invariant verification
// - Smart shrinking for minimal failing cases
// - PII leak detection (never_logged invariants)
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
  oneOf,
  constant,
  fromEnum,
  optional,
  record,
  fromConstraints,
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
} from './cli-integration.js';

export type {
  PBTVerifyOptions,
  PBTVerifyResult,
} from './cli-integration.js';
