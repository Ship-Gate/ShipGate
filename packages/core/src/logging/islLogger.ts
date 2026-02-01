/**
 * ISL Unified Logger
 * 
 * Provides consistent logging across all ISL subsystems with support for:
 * - Human-readable pretty output (default)
 * - JSON structured events (--json flag compatible)
 * - Evidence report artifact generation
 * 
 * @example
 * ```typescript
 * import { createISLLogger, ISL_EVENTS } from '@isl/core/logging';
 * 
 * const logger = createISLLogger({ subsystem: 'verifier' });
 * 
 * logger.info(ISL_EVENTS.VERIFY_START, 'Starting verification', { specName: 'auth.isl' });
 * 
 * const endTimer = logger.startTimer(ISL_EVENTS.VERIFY_COMPLETE, 'Verification complete');
 * // ... do verification work ...
 * endTimer(); // logs with duration
 * ```
 */

import type {
  ISLLogger,
  ISLLogEvent,
  LogLevel,
  EventName,
  EventCategory,
  LoggerOptions,
  LogErrorDetails,
  Subsystem,
} from './logTypes.js';
import { LOG_LEVEL_VALUES, ISL_EVENTS } from './logTypes.js';
import { formatPretty, formatJSON } from './formatters.js';

// Re-export types and constants for convenience
export type { ISLLogger, ISLLogEvent, LogLevel, EventName, LoggerOptions, LogErrorDetails, Subsystem };
export { ISL_EVENTS, LOG_LEVEL_VALUES };
export { formatPretty, formatJSON, formatNDJSON, formatJSONArray, toEvidenceArtifact } from './formatters.js';
export type { FormatOptions } from './formatters.js';

/**
 * Default logger options
 */
const DEFAULT_OPTIONS: Omit<Required<LoggerOptions>, 'correlationId' | 'output'> = {
  level: 'info',
  subsystem: 'core',
  format: 'pretty',
  colors: true,
  timestamps: true,
};

/**
 * Detect if running with --json flag
 */
function detectJSONMode(): boolean {
  if (typeof process !== 'undefined' && process.argv) {
    return process.argv.includes('--json') || process.argv.includes('-j');
  }
  return false;
}

/**
 * Detect if colors should be disabled
 */
function detectNoColor(): boolean {
  if (typeof process !== 'undefined') {
    const env = process.env || {};
    return (
      env.NO_COLOR === '1' ||
      env.FORCE_COLOR === '0' ||
      !process.stdout?.isTTY
    );
  }
  return true;
}

/**
 * Map event name to category
 */
function inferCategory(event: EventName): EventCategory {
  if (event.includes('start') || event.includes('stop') || event === 'init' || event === 'ready') {
    return 'lifecycle';
  }
  if (event.includes('complete') || event.includes('result') || event.includes('score')) {
    return 'result';
  }
  if (event.includes('error') || event.includes('fail')) {
    return 'error';
  }
  if (event.includes('metric') || event.includes('duration')) {
    return 'metric';
  }
  if (event.includes('evidence') || event.includes('artifact')) {
    return 'evidence';
  }
  return 'operation';
}

/**
 * Convert Error to LogErrorDetails
 */
function errorToDetails(error: Error | LogErrorDetails): LogErrorDetails {
  if ('name' in error && 'message' in error && !('stack' in error && typeof error.stack === 'undefined')) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }
  }
  return error as LogErrorDetails;
}

/**
 * Generate a random correlation ID
 */
function generateCorrelationId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Logger implementation
 */
class ISLLoggerImpl implements ISLLogger {
  private options: Required<Omit<LoggerOptions, 'correlationId' | 'output'>> & {
    correlationId?: string;
    output: (formatted: string) => void;
  };
  private events: ISLLogEvent[] = [];
  private specFingerprint?: string;
  private specName?: string;
  
  constructor(options: LoggerOptions) {
    const isJSON = options.format === 'json' || detectJSONMode();
    const noColor = detectNoColor();
    
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      format: isJSON ? 'json' : (options.format ?? 'pretty'),
      colors: noColor ? false : (options.colors ?? DEFAULT_OPTIONS.colors),
      output: options.output ?? ((msg: string) => console.log(msg)),
    };
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.options.level];
  }
  
  private createEvent(
    level: LogLevel,
    event: EventName,
    message: string,
    data?: Record<string, unknown>,
    error?: Error | LogErrorDetails,
    durationMs?: number,
  ): ISLLogEvent {
    const logEvent: ISLLogEvent = {
      timestamp: new Date().toISOString(),
      level,
      event,
      subsystem: this.options.subsystem,
      category: inferCategory(event),
      message,
    };
    
    if (this.options.correlationId) logEvent.correlationId = this.options.correlationId;
    if (this.specFingerprint) logEvent.specFingerprint = this.specFingerprint;
    if (this.specName) logEvent.specName = this.specName;
    if (durationMs !== undefined) logEvent.durationMs = durationMs;
    if (data) logEvent.data = data;
    if (error) logEvent.error = errorToDetails(error);
    
    return logEvent;
  }
  
  private log(
    level: LogLevel,
    event: EventName,
    message: string,
    data?: Record<string, unknown>,
    error?: Error | LogErrorDetails,
    durationMs?: number,
  ): void {
    if (!this.shouldLog(level)) return;
    
    const logEvent = this.createEvent(level, event, message, data, error, durationMs);
    this.events.push(logEvent);
    
    const formatted = this.options.format === 'json'
      ? formatJSON(logEvent)
      : formatPretty(logEvent, {
          colors: this.options.colors,
          timestamps: this.options.timestamps,
        });
    
    this.options.output(formatted);
  }
  
  debug(event: EventName, message: string, data?: Record<string, unknown>): void {
    this.log('debug', event, message, data);
  }
  
  info(event: EventName, message: string, data?: Record<string, unknown>): void {
    this.log('info', event, message, data);
  }
  
  warn(event: EventName, message: string, data?: Record<string, unknown>): void {
    this.log('warn', event, message, data);
  }
  
  error(event: EventName, message: string, error?: Error | LogErrorDetails, data?: Record<string, unknown>): void {
    this.log('error', event, message, data, error);
  }
  
  fatal(event: EventName, message: string, error?: Error | LogErrorDetails, data?: Record<string, unknown>): void {
    this.log('fatal', event, message, data, error);
  }
  
  child(options: Partial<LoggerOptions>): ISLLogger {
    return new ISLLoggerImpl({
      ...this.options,
      ...options,
      correlationId: options.correlationId ?? this.options.correlationId,
    });
  }
  
  setCorrelationId(id: string): void {
    this.options.correlationId = id;
  }
  
  setSpecContext(fingerprint: string, name?: string): void {
    this.specFingerprint = fingerprint;
    this.specName = name;
  }
  
  startTimer(event: EventName, message: string): () => void {
    const start = performance.now();
    this.debug(event, `${message} (started)`, { timerStart: true });
    
    return () => {
      const durationMs = Math.round(performance.now() - start);
      this.log('info', event, message, { timerEnd: true }, undefined, durationMs);
    };
  }
  
  getEvents(): ISLLogEvent[] {
    return [...this.events];
  }
  
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Create a new ISL logger instance
 * 
 * @param options Logger configuration
 * @returns ISLLogger instance
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const logger = createISLLogger({ subsystem: 'translator' });
 * logger.info(ISL_EVENTS.TRANSLATE_START, 'Starting translation');
 * 
 * // With JSON output
 * const jsonLogger = createISLLogger({ subsystem: 'verifier', format: 'json' });
 * 
 * // With correlation ID for tracing
 * const tracedLogger = createISLLogger({ 
 *   subsystem: 'agent',
 *   correlationId: 'req-abc123'
 * });
 * 
 * // Child logger for specific context
 * const specLogger = logger.child({ correlationId: 'spec-xyz' });
 * specLogger.setSpecContext('sha256:abc...', 'auth.isl');
 * ```
 */
export function createISLLogger(options: LoggerOptions): ISLLogger {
  return new ISLLoggerImpl(options);
}

/**
 * Create a correlation ID for tracing related log events
 */
export function createCorrelationId(): string {
  return generateCorrelationId();
}

/**
 * Create a no-op logger for testing or disabled logging
 */
export function createNullLogger(): ISLLogger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child: () => createNullLogger(),
    setCorrelationId: noop,
    setSpecContext: noop,
    startTimer: () => noop,
    getEvents: () => [],
    clearEvents: noop,
  };
}

/**
 * Create a memory logger that only stores events (no output)
 * Useful for testing
 */
export function createMemoryLogger(options: Omit<LoggerOptions, 'output'>): ISLLogger {
  return new ISLLoggerImpl({
    ...options,
    output: () => {}, // No output
  });
}
