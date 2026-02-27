/**
 * ISL Unified Logger - Type Definitions
 * 
 * Provides consistent log event types for all ISL subsystems:
 * - Translator (ISL → TypeScript/contracts)
 * - Agent (AI verification)
 * - Verifier (test execution)
 */

/**
 * Log severity levels aligned with standard logging conventions
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * ISL subsystem identifiers
 */
export type Subsystem = 
  | 'translator'   // ISL spec translation
  | 'agent'        // AI agent verification
  | 'verifier'     // Runtime verification/test runner
  | 'parser'       // ISL parsing
  | 'typechecker'  // Type checking
  | 'codegen'      // Code generation
  | 'cli'          // CLI operations
  | 'lsp'          // Language server
  | 'core';        // Core utilities

/**
 * Log event categories for filtering and analysis
 */
export type EventCategory = 
  | 'lifecycle'    // Start, stop, init events
  | 'operation'    // Main operations (parse, translate, verify)
  | 'result'       // Operation results
  | 'error'        // Errors and failures
  | 'metric'       // Performance metrics
  | 'evidence';    // Evidence collection events

/**
 * Recommended event names for consistent logging across subsystems
 */
export const ISL_EVENTS = {
  // Lifecycle events
  INIT: 'init',
  START: 'start',
  STOP: 'stop',
  READY: 'ready',
  
  // Translator events
  TRANSLATE_START: 'translate:start',
  TRANSLATE_COMPLETE: 'translate:complete',
  TRANSLATE_ERROR: 'translate:error',
  
  // Parser events
  PARSE_START: 'parse:start',
  PARSE_COMPLETE: 'parse:complete',
  PARSE_ERROR: 'parse:error',
  
  // Agent events
  AGENT_PLAN: 'agent:plan',
  AGENT_EXECUTE: 'agent:execute',
  AGENT_VERIFY: 'agent:verify',
  AGENT_SCORE: 'agent:score',
  
  // Verifier events
  VERIFY_START: 'verify:start',
  VERIFY_CLAUSE: 'verify:clause',
  VERIFY_COMPLETE: 'verify:complete',
  VERIFY_ERROR: 'verify:error',
  
  // Evidence events
  EVIDENCE_COLLECT: 'evidence:collect',
  EVIDENCE_ARTIFACT: 'evidence:artifact',
  EVIDENCE_REPORT: 'evidence:report',
  
  // Codegen events
  CODEGEN_START: 'codegen:start',
  CODEGEN_FILE: 'codegen:file',
  CODEGEN_COMPLETE: 'codegen:complete',
  
  // Metric events
  METRIC_DURATION: 'metric:duration',
  METRIC_COUNT: 'metric:count',
  METRIC_SCORE: 'metric:score',
} as const;

export type EventName = typeof ISL_EVENTS[keyof typeof ISL_EVENTS] | string;

/**
 * Base structure for all ISL log events
 */
export interface ISLLogEvent {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log severity level */
  level: LogLevel;
  /** Event name (use ISL_EVENTS constants) */
  event: EventName;
  /** Subsystem that generated the event */
  subsystem: Subsystem;
  /** Event category for filtering */
  category: EventCategory;
  /** Human-readable message */
  message: string;
  /** Optional correlation ID for tracing related events */
  correlationId?: string;
  /** Specification fingerprint (for evidence compatibility) */
  specFingerprint?: string;
  /** Specification name */
  specName?: string;
  /** Duration in milliseconds (for timed operations) */
  durationMs?: number;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Error details (if applicable) */
  error?: LogErrorDetails;
}

/**
 * Error details for error events
 */
export interface LogErrorDetails {
  /** Error name/type */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Error code */
  code?: string;
}

/**
 * Options for creating a logger instance
 */
export interface LoggerOptions {
  /** Minimum level to output */
  level?: LogLevel;
  /** Subsystem identifier */
  subsystem: Subsystem;
  /** Output format */
  format?: 'pretty' | 'json';
  /** Enable colors in pretty output */
  colors?: boolean;
  /** Include timestamps in output */
  timestamps?: boolean;
  /** Default correlation ID for all events */
  correlationId?: string;
  /** Custom output function (defaults to console) */
  output?: (formatted: string) => void;
}

/**
 * Logger instance interface
 */
export interface ISLLogger {
  /** Log debug message */
  debug(event: EventName, message: string, data?: Record<string, unknown>): void;
  /** Log info message */
  info(event: EventName, message: string, data?: Record<string, unknown>): void;
  /** Log warning message */
  warn(event: EventName, message: string, data?: Record<string, unknown>): void;
  /** Log error message */
  error(event: EventName, message: string, error?: Error | LogErrorDetails, data?: Record<string, unknown>): void;
  /** Log fatal message */
  fatal(event: EventName, message: string, error?: Error | LogErrorDetails, data?: Record<string, unknown>): void;
  
  /** Create a child logger with additional context */
  child(options: Partial<LoggerOptions>): ISLLogger;
  
  /** Set correlation ID for subsequent events */
  setCorrelationId(id: string): void;
  
  /** Set spec context for evidence compatibility */
  setSpecContext(fingerprint: string, name?: string): void;
  
  /** Start a timed operation, returns function to end it */
  startTimer(event: EventName, message: string): () => void;
  
  /** Get all events (useful for testing) */
  getEvents(): ISLLogEvent[];
  
  /** Clear collected events */
  clearEvents(): void;
}

/**
 * Log level numeric values for comparison
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};
