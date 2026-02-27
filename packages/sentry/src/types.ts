// ============================================================================
// Sentry Integration Types
// ============================================================================

import type { SeverityLevel } from '@sentry/types';

/**
 * Verification verdict types
 */
export type Verdict = 'verified' | 'risky' | 'unsafe';

/**
 * Check types for ISL
 */
export type CheckType = 'precondition' | 'postcondition' | 'invariant' | 'temporal';

/**
 * Coverage categories
 */
export type CoverageCategory = 'preconditions' | 'postconditions' | 'invariants';

/**
 * ISL Sentry initialization options
 */
export interface ISLSentryOptions {
  /** Sentry DSN */
  dsn: string;

  /** Environment name (e.g., 'production', 'staging') */
  environment?: string;

  /** Release version */
  release?: string;

  /** Service name for distributed tracing */
  serviceName?: string;

  /** Sample rate for traces (0.0 to 1.0) */
  tracesSampleRate?: number;

  /** Sample rate for profiles (0.0 to 1.0) */
  profilesSampleRate?: number;

  /** Enable ISL integration (default: true) */
  enableISLIntegration?: boolean;

  /** Enable performance monitoring (default: true) */
  enablePerformance?: boolean;

  /** Enable profiling (default: false in production) */
  enableProfiling?: boolean;

  /** Custom tags to apply to all events */
  defaultTags?: Record<string, string>;

  /** Fields to redact from input/output */
  redactFields?: string[];

  /** Maximum depth for context serialization */
  maxContextDepth?: number;

  /** Maximum length for string values in context */
  maxContextStringLength?: number;

  /** Custom fingerprint function */
  fingerprintFn?: (event: ISLEvent) => string[];

  /** Before send hook for ISL events */
  beforeSendISL?: (event: ISLEvent) => ISLEvent | null;

  /** Debug mode */
  debug?: boolean;
}

/**
 * ISL event context
 */
export interface ISLContext {
  /** Domain name */
  domain: string;

  /** Behavior name (optional for domain-level events) */
  behavior?: string;

  /** Check type */
  checkType?: CheckType;

  /** Check expression */
  expression?: string;

  /** Timestamp */
  timestamp: number;

  /** Execution ID for correlation */
  executionId?: string;

  /** Parent execution ID */
  parentExecutionId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Verification result for tracking
 */
export interface VerifyResult {
  /** Domain name */
  domain: string;

  /** Behavior name */
  behavior: string;

  /** Verification verdict */
  verdict: Verdict;

  /** Verification score (0-100) */
  score: number;

  /** Coverage ratios */
  coverage: CoverageInfo;

  /** Failed checks */
  failed: FailedCheck[];

  /** Passed checks */
  passed: PassedCheck[];

  /** Duration in milliseconds */
  duration?: number;

  /** Execution ID */
  executionId?: string;
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  preconditions: number;
  postconditions: number;
  invariants: number;
  total: number;
}

/**
 * Failed check details
 */
export interface FailedCheck {
  /** Check name */
  name: string;

  /** Check category */
  category: CheckType;

  /** Check expression */
  expression: string;

  /** Error message */
  error: string;

  /** Expected value (if applicable) */
  expected?: unknown;

  /** Actual value (if applicable) */
  actual?: unknown;

  /** Stack trace */
  stackTrace?: string;
}

/**
 * Passed check details
 */
export interface PassedCheck {
  /** Check name */
  name: string;

  /** Check category */
  category: CheckType;

  /** Check expression */
  expression: string;

  /** Duration in milliseconds */
  duration?: number;
}

/**
 * ISL event for Sentry
 */
export interface ISLEvent {
  /** Event type */
  type: 'verification' | 'precondition' | 'postcondition' | 'invariant' | 'behavior' | 'error';

  /** ISL context */
  context: ISLContext;

  /** Severity level */
  level: SeverityLevel;

  /** Event message */
  message: string;

  /** Additional data */
  data?: Record<string, unknown>;

  /** Tags */
  tags?: Record<string, string>;

  /** Fingerprint for grouping */
  fingerprint?: string[];
}

/**
 * Behavior execution options
 */
export interface BehaviorTrackingOptions {
  /** Domain name */
  domain: string;

  /** Behavior name */
  behavior: string;

  /** Custom span attributes */
  attributes?: Record<string, string | number | boolean>;

  /** Sample this specific execution */
  sample?: boolean;

  /** Execution ID for correlation */
  executionId?: string;
}

/**
 * Breadcrumb data for ISL operations
 */
export interface ISLBreadcrumbData {
  /** Domain name */
  domain: string;

  /** Behavior name */
  behavior?: string;

  /** Check type */
  checkType?: CheckType;

  /** Check expression */
  expression?: string;

  /** Result (pass/fail) */
  result?: 'pass' | 'fail';

  /** Additional data */
  [key: string]: unknown;
}

/**
 * Span data for performance tracking
 */
export interface ISLSpanData {
  /** Span name */
  name: string;

  /** Operation type */
  op: string;

  /** Span attributes */
  attributes?: Record<string, string | number | boolean>;

  /** Start time (optional, defaults to now) */
  startTime?: number;
}

/**
 * Middleware options
 */
export interface MiddlewareOptions {
  /** Header name for domain */
  domainHeader?: string;

  /** Header name for behavior */
  behaviorHeader?: string;

  /** Extract domain/behavior from request path */
  extractFromPath?: boolean;

  /** Path pattern for extraction (e.g., '/api/:domain/:behavior') */
  pathPattern?: string;

  /** Skip middleware for certain paths */
  skipPaths?: string[];

  /** Custom extractor function */
  extractor?: (req: unknown) => { domain?: string; behavior?: string } | null;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: Required<Omit<ISLSentryOptions, 'dsn' | 'fingerprintFn' | 'beforeSendISL'>> = {
  environment: 'development',
  release: undefined as unknown as string,
  serviceName: 'isl-service',
  tracesSampleRate: 1.0,
  profilesSampleRate: 0.1,
  enableISLIntegration: true,
  enablePerformance: true,
  enableProfiling: false,
  defaultTags: {},
  redactFields: ['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization'],
  maxContextDepth: 5,
  maxContextStringLength: 1000,
  debug: false,
};

/**
 * Default middleware options
 */
export const DEFAULT_MIDDLEWARE_OPTIONS: Required<Omit<MiddlewareOptions, 'extractor' | 'pathPattern'>> = {
  domainHeader: 'x-isl-domain',
  behaviorHeader: 'x-isl-behavior',
  extractFromPath: false,
  skipPaths: ['/health', '/ready', '/metrics'],
};

/**
 * Options for capturing ISL events to Sentry
 */
export interface ISLCaptureOptions {
  /** Severity level for the event */
  level?: SeverityLevel;
  /** Additional tags */
  tags?: Record<string, string>;
  /** Additional extra data */
  extra?: Record<string, unknown>;
  /** Custom fingerprint for grouping */
  fingerprint?: string[];
}

/**
 * Options for sanitizing data before sending to Sentry
 */
export interface SanitizeOptions {
  /** Fields to redact from data */
  redactFields?: string[];
  /** Maximum depth for nested objects */
  maxDepth?: number;
  /** Maximum string length */
  maxStringLength?: number;
}

/**
 * Express-compatible request type for middleware
 */
export interface ISLRequest {
  method?: string;
  url?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  params?: Record<string, string>;
}

/**
 * Express-compatible response type for middleware
 */
export interface ISLResponse {
  statusCode: number;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

/**
 * Express-compatible next function
 */
export type NextFunction = (error?: unknown) => void;
