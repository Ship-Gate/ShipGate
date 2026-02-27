// ============================================================================
// ISL Sentry Integration - Public API
// ============================================================================

// Client setup
export {
  initSentry,
  isInitialized,
  getOptions,
  flush,
  close,
  setISLContext,
  setISLTags,
  clearISLContext,
  withISLScope,
  Sentry,
} from './client';

// Main tracker class
export { ISLSentry } from './tracker';

// Types
export type {
  ISLSentryOptions,
  ISLContext,
  VerifyResult,
  CoverageInfo,
  FailedCheck,
  PassedCheck,
  ISLEvent,
  BehaviorTrackingOptions,
  ISLBreadcrumbData,
  ISLSpanData,
  MiddlewareOptions,
  Verdict,
  CheckType,
  CoverageCategory,
} from './types';

export { DEFAULT_OPTIONS, DEFAULT_MIDDLEWARE_OPTIONS } from './types';

// Errors
export {
  ISLError,
  PreconditionError,
  PostconditionError,
  InvariantError,
  TemporalError,
  VerificationError,
  isISLError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  isTemporalError,
  isVerificationError,
} from './errors';

// Integrations
export {
  ISLIntegration,
  createISLIntegration,
  VerificationIntegration,
  createVerificationIntegration,
  getVerificationIntegration,
  recordVerification,
  PreconditionIntegration,
  createPreconditionIntegration,
  getPreconditionIntegration,
  trackPreconditionFailure,
  PostconditionIntegration,
  createPostconditionIntegration,
  getPostconditionIntegration,
  trackPostconditionFailure,
} from './integrations';

// Context management
export {
  createISLContext,
  pushContext,
  popContext,
  getCurrentContext,
  getContextDepth,
  withContext,
  withContextAsync,
  setDomainContext,
  setBehaviorContext,
  setCheckContext,
  setVerificationContext,
  clearAllContexts,
  ISLContextManager,
  contextManager,
} from './context/isl';

// Breadcrumbs
export {
  ISL_BREADCRUMB_CATEGORIES,
  addISLBreadcrumb,
  addBehaviorBreadcrumb,
  addCheckBreadcrumb,
  addPreconditionBreadcrumb,
  addPostconditionBreadcrumb,
  addInvariantBreadcrumb,
  addTemporalBreadcrumb,
  addVerificationBreadcrumb,
  addDomainBreadcrumb,
  createVerificationTrail,
  addBreadcrumbs,
  clearISLBreadcrumbs,
} from './breadcrumbs/isl';

// Performance spans
export {
  ISL_OPERATIONS,
  startBehaviorSpan,
  startVerificationSpan,
  startCheckSpan,
  recordVerificationToSpan,
  createISLSpan,
  withBehaviorTracking,
  withVerificationTracking,
  measureTiming,
  addTimingMeasurement,
  startDomainTransaction,
} from './performance/spans';

// Middleware
export {
  sentryISLMiddleware,
  koaISLMiddleware,
  fastifyISLPlugin,
  wrapRequestHandler,
  islErrorHandler,
} from './middleware';

// Utilities
export {
  sanitizeInput,
  sanitizeOutput,
  sanitizeState,
  generateExecutionId,
  createFingerprint,
  formatDuration,
  safeStringify,
} from './utils';
