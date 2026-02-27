// ============================================================================
// Runtime Verify Types
// ============================================================================

/**
 * Verification event types for structured logging
 */
export type VerificationEventType =
  | 'precondition:check'
  | 'precondition:pass'
  | 'precondition:fail'
  | 'postcondition:check'
  | 'postcondition:pass'
  | 'postcondition:fail'
  | 'invariant:check'
  | 'invariant:pass'
  | 'invariant:fail';

/**
 * Verification event payload
 */
export interface VerificationEvent {
  /** Event type */
  type: VerificationEventType;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Unique event ID */
  eventId: string;
  /** Human-readable label for the check */
  label: string;
  /** The expression being evaluated (as string) */
  expression: string;
  /** Whether the check passed */
  passed: boolean;
  /** Context values at time of check */
  context: VerificationContext;
  /** Stack trace if available */
  stack?: string;
  /** Duration of the check in ms */
  duration?: number;
}

/**
 * Context passed to verification checks
 */
export interface VerificationContext {
  /** Input values */
  input?: Record<string, unknown>;
  /** Result value (for postconditions) */
  result?: unknown;
  /** Previous state (for invariants with old() references) */
  oldState?: Record<string, unknown>;
  /** Current state */
  state?: Record<string, unknown>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for verification assertions
 */
export interface AssertionOptions {
  /** Human-readable label for the assertion */
  label?: string;
  /** Additional context for error messages */
  context?: VerificationContext;
  /** Whether to throw on failure (default: true) */
  throwOnFail?: boolean;
  /** Custom error code */
  errorCode?: string;
}

/**
 * Result of a verification check
 */
export interface VerificationResult {
  /** Whether the check passed */
  passed: boolean;
  /** The type of check */
  type: 'precondition' | 'postcondition' | 'invariant';
  /** Human-readable label */
  label: string;
  /** The expression that was checked */
  expression: string;
  /** Duration in ms */
  duration: number;
  /** Error if check failed */
  error?: VerificationError;
}

/**
 * Verification error details
 */
export interface VerificationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Whether the error is retriable */
  retriable: boolean;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Hook handler function type
 */
export type VerificationHookHandler = (event: VerificationEvent) => void | Promise<void>;

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Filter events by type */
  filter?: VerificationEventType[];
  /** Only trigger on failures */
  failuresOnly?: boolean;
  /** Async mode - don't await handler */
  async?: boolean;
}

/**
 * Snippet generation options
 */
export interface SnippetOptions {
  /** Indentation string (default: '  ') */
  indent?: string;
  /** Include type annotations */
  includeTypes?: boolean;
  /** Target language (default: 'typescript') */
  language?: 'typescript' | 'javascript';
  /** Custom error class name */
  errorClass?: string;
}

/**
 * Generated snippet result
 */
export interface GeneratedSnippet {
  /** The generated code */
  code: string;
  /** Hash for determinism verification */
  hash: string;
  /** Imports required by this snippet */
  imports: string[];
}
