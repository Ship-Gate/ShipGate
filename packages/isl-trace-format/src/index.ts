/**
 * ISL Trace Format
 * 
 * Stable trace event schema used by:
 * - Generated tests
 * - Healer iterations
 * - Verification engine
 * - Proof bundles
 * 
 * @module @isl-lang/trace-format
 */

// Types - Core
export type {
  TraceEvent,
  Trace,
  TraceEventKind,
  CoreEventKind,
  HandlerCallEvent,
  HandlerReturnEvent,
  HandlerErrorEvent,
  StateChangeEvent,
  CheckEvent,
  TraceMetadata,
  TimingInfo,
} from './types.js';

// Types - Login/Auth specific
export type {
  LoginEventKind,
  LoginTraceEvent,
  LoginTraceMetadata,
  RateLimitCheckedEvent,
  AuditWrittenEvent,
  SessionCreatedEvent,
  UserUpdatedEvent,
  ErrorReturnedEvent,
} from './types.js';

// Redaction
export {
  redactTraceData,
  redactWithConfig,
  redactHeaders,
  sanitizeInputs,
  sanitizeOutputs,
  sanitizeError,
  containsSensitiveData,
  detectSensitivePatterns,
  partialMaskEmail,
  partialMaskId,
  REDACTED_FIELDS,
  ALWAYS_REDACTED_FIELDS,
  PII_FIELDS,
  REDACTION_PATTERNS,
  type RedactionConfig,
} from './redaction.js';

// Emitter
export {
  TraceEmitter,
  createTraceEmitter,
  createTraceEmitterWithCorrelation,
  type TraceEmitterOptions,
} from './emitter.js';

// Schema validation
export {
  traceEventSchema,
  traceSchema,
  timingInfoSchema,
  loginTraceMetadataSchema,
  validateTraceEvent,
  validateTrace,
  isValidTraceEvent,
  isValidTrace,
  CORE_EVENT_KINDS,
  LOGIN_EVENT_KINDS,
  ALL_EVENT_KINDS,
} from './schema.js';

// Fixtures (for testing)
export {
  fixtures,
  // Core fixtures
  sampleHandlerCallEvent,
  sampleHandlerReturnEvent,
  samplePreconditionCheck,
  samplePostconditionCheck,
  sampleTrace,
  sampleNestedTrace,
  sampleFailingTrace,
  sampleHealerIterationTrace,
  // Login-specific fixtures
  sampleRateLimitCheckedEvent,
  sampleRateLimitExceededEvent,
  sampleAuditWrittenEvent,
  sampleAuditWrittenFailureEvent,
  sampleSessionCreatedEvent,
  sampleUserUpdatedEvent,
  sampleErrorReturnedEvent,
  sampleRateLimitErrorEvent,
  // Complete Login flow traces
  loginSuccessTrace,
  loginInvalidCredentialsTrace,
  loginRateLimitedTrace,
} from './fixtures.js';
