/**
 * Trace Format Types
 * 
 * Stable schema for trace events used by:
 * - Generated tests
 * - Healer iterations
 * - Verification engine
 * - Proof bundles
 * 
 * @module @isl-lang/trace-format
 */

/**
 * Core trace event kinds (handler lifecycle)
 */
export type CoreEventKind =
  | 'handler_call'
  | 'handler_return'
  | 'handler_error'
  | 'state_change'
  | 'check'
  | 'invariant'
  | 'precondition'
  | 'postcondition'
  | 'temporal'
  | 'nested';

/**
 * Login/Auth specific event kinds for verification
 * These enable evaluator + adapters to verify Login clauses
 */
export type LoginEventKind =
  | 'rate_limit_checked'   // Rate limiting check was performed
  | 'audit_written'        // Audit log entry was written
  | 'session_created'      // User session was created
  | 'user_updated'         // User record was updated (e.g., last_login)
  | 'error_returned';      // Error response was returned to client

/**
 * All trace event kinds
 */
export type TraceEventKind = CoreEventKind | LoginEventKind;

/**
 * Timing fields for temporal constraints verification
 */
export interface TimingInfo {
  /** Start timestamp in milliseconds (high-res) */
  startMs: number;
  /** End timestamp in milliseconds (high-res) */
  endMs?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Sequence number within the trace (for ordering verification) */
  sequence?: number;
}

/**
 * Base trace event structure
 */
export interface TraceEvent {
  /** ISO 8601 timestamp */
  time: string;
  /** Event kind/type */
  kind: TraceEventKind;
  /** Correlation ID for tracing across systems */
  correlationId: string;
  /** Handler/function name */
  handler: string;
  /** Sanitized inputs (PII redacted) */
  inputs: Record<string, unknown>;
  /** Sanitized outputs (PII redacted) */
  outputs: Record<string, unknown>;
  /** Nested events (for hierarchical traces) */
  events: TraceEvent[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Timing information for temporal constraint verification */
  timing?: TimingInfo;
}

/**
 * Handler call event (entry point)
 */
export interface HandlerCallEvent extends TraceEvent {
  kind: 'handler_call';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

/**
 * Handler return event (successful completion)
 */
export interface HandlerReturnEvent extends TraceEvent {
  kind: 'handler_return';
  inputs: Record<string, unknown>;
  outputs: {
    result: unknown;
    duration?: number;
  };
}

/**
 * Handler error event (failure)
 */
export interface HandlerErrorEvent extends TraceEvent {
  kind: 'handler_error';
  inputs: Record<string, unknown>;
  outputs: {
    error: {
      name: string;
      message: string;
      code?: string;
      stack?: string;
    };
  };
}

/**
 * State change event
 */
export interface StateChangeEvent extends TraceEvent {
  kind: 'state_change';
  inputs: {
    path: string[];
    oldValue: unknown;
  };
  outputs: {
    newValue: unknown;
    source: string;
  };
}

/**
 * Check event (precondition/postcondition/invariant)
 */
export interface CheckEvent extends TraceEvent {
  kind: 'check';
  inputs: {
    expression: string;
    expected?: unknown;
  };
  outputs: {
    passed: boolean;
    actual?: unknown;
    message?: string;
    category: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion';
  };
}

// ============================================================================
// Login/Auth Specific Events
// These types enable evaluator + adapters to verify Login clauses
// ============================================================================

/**
 * Rate limit check event
 * Emitted when rate limiting is checked (before authentication attempt)
 */
export interface RateLimitCheckedEvent extends TraceEvent {
  kind: 'rate_limit_checked';
  inputs: {
    /** Identifier being rate limited (e.g., IP, user ID, email hash) */
    identifier: string;
    /** Type of identifier (anonymized) */
    identifierType: 'ip' | 'user_id' | 'email_hash' | 'fingerprint' | 'other';
    /** Maximum attempts allowed */
    limit: number;
    /** Time window in seconds */
    windowSeconds: number;
  };
  outputs: {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Current count of attempts */
    currentCount: number;
    /** Remaining attempts */
    remaining: number;
    /** Seconds until window resets */
    resetInSeconds: number;
    /** Whether the rate limit was exceeded */
    exceeded: boolean;
  };
}

/**
 * Audit log write event
 * Emitted when an audit log entry is written
 */
export interface AuditWrittenEvent extends TraceEvent {
  kind: 'audit_written';
  inputs: {
    /** Audit action type */
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'password_reset' | 'session_created' | 'session_revoked' | 'account_locked' | 'other';
    /** Actor identifier (sanitized) */
    actorId?: string;
    /** Target resource (sanitized) */
    targetId?: string;
  };
  outputs: {
    /** Whether audit was successfully written */
    success: boolean;
    /** Audit log entry ID */
    auditId: string;
    /** Audit timestamp */
    timestamp: string;
    /** Storage destination */
    destination: 'database' | 'file' | 'external' | 'memory';
  };
}

/**
 * Session created event
 * Emitted when a user session is established
 */
export interface SessionCreatedEvent extends TraceEvent {
  kind: 'session_created';
  inputs: {
    /** User identifier (sanitized) */
    userId: string;
    /** Session type */
    sessionType: 'access_token' | 'refresh_token' | 'session_cookie' | 'api_key';
    /** Requested scopes/permissions */
    scopes?: string[];
  };
  outputs: {
    /** Session ID (sanitized - first/last chars only) */
    sessionId: string;
    /** Token type */
    tokenType?: 'bearer' | 'jwt' | 'opaque';
    /** Expiration timestamp */
    expiresAt: string;
    /** Session metadata (sanitized) */
    metadata?: {
      userAgent?: string;
      ipCountry?: string;
      deviceType?: string;
    };
  };
}

/**
 * User updated event
 * Emitted when user record is updated (e.g., last_login timestamp)
 */
export interface UserUpdatedEvent extends TraceEvent {
  kind: 'user_updated';
  inputs: {
    /** User identifier (sanitized) */
    userId: string;
    /** Fields being updated */
    fields: string[];
    /** Update reason/trigger */
    reason: 'login' | 'logout' | 'profile_update' | 'password_change' | 'security_event' | 'other';
  };
  outputs: {
    /** Whether update was successful */
    success: boolean;
    /** Updated timestamp */
    updatedAt: string;
    /** Fields that were changed (names only, no values) */
    changedFields: string[];
  };
}

/**
 * Error returned event
 * Emitted when an error response is sent to the client
 */
export interface ErrorReturnedEvent extends TraceEvent {
  kind: 'error_returned';
  inputs: {
    /** Original error (sanitized) */
    error: {
      name: string;
      code?: string;
    };
    /** Context of the error */
    context: string;
  };
  outputs: {
    /** HTTP status code */
    statusCode: number;
    /** Error code returned to client */
    errorCode: string;
    /** Safe error message (no PII) */
    message: string;
    /** Whether this is a client error (4xx) or server error (5xx) */
    errorType: 'client' | 'server' | 'validation' | 'auth' | 'rate_limit';
    /** Retry information (if applicable) */
    retry?: {
      allowed: boolean;
      afterSeconds?: number;
    };
  };
}

/**
 * Union of all Login-specific event types
 */
export type LoginTraceEvent =
  | RateLimitCheckedEvent
  | AuditWrittenEvent
  | SessionCreatedEvent
  | UserUpdatedEvent
  | ErrorReturnedEvent;

/**
 * Complete trace (collection of events)
 */
export interface Trace {
  /** Trace ID */
  id: string;
  /** Trace name/description */
  name: string;
  /** Domain/behavior name */
  domain: string;
  /** Start time (ISO 8601) */
  startTime: string;
  /** End time (ISO 8601, optional) */
  endTime?: string;
  /** Root correlation ID */
  correlationId: string;
  /** All events in the trace */
  events: TraceEvent[];
  /** Initial state snapshot */
  initialState?: Record<string, unknown>;
  /** Metadata */
  metadata?: TraceMetadata;
}

/**
 * Trace metadata
 */
export interface TraceMetadata {
  /** Test name (if from generated test) */
  testName?: string;
  /** Scenario description */
  scenario?: string;
  /** Implementation identifier */
  implementation?: string;
  /** Version */
  version?: string;
  /** Environment */
  environment?: string;
  /** Whether trace passed verification */
  passed?: boolean;
  /** Index of first failure (if any) */
  failureIndex?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Healer iteration number (if applicable) */
  iteration?: number;
  /** Proof bundle ID (if applicable) */
  proofBundleId?: string;
  /** Login/auth specific metadata */
  auth?: LoginTraceMetadata;
}

/**
 * Login-specific trace metadata
 */
export interface LoginTraceMetadata {
  /** Login outcome */
  outcome: 'success' | 'invalid_credentials' | 'rate_limited' | 'account_locked' | 'validation_error' | 'server_error';
  /** User identifier (sanitized hash) */
  userIdHash?: string;
  /** Whether MFA was required */
  mfaRequired?: boolean;
  /** Whether MFA was completed */
  mfaCompleted?: boolean;
  /** Number of recent failed attempts (anonymized) */
  recentFailedAttempts?: number;
  /** Whether account was locked after this attempt */
  accountLocked?: boolean;
}
