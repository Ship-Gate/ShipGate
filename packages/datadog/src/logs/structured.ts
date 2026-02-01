// ============================================================================
// Structured Logging for Datadog
// ============================================================================

import type { DatadogClient } from '../client.js';
import type { LogEntry, LogLevel, Span } from '../types.js';

/**
 * Log context for correlation
 */
export interface LogContext {
  domain?: string;
  behavior?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Include timestamps (default: true) */
  timestamps?: boolean;
  /** Include source location (default: false in production) */
  includeSource?: boolean;
  /** Default context applied to all logs */
  defaultContext?: LogContext;
  /** Custom formatter */
  formatter?: (entry: LogEntry) => string;
}

/**
 * Log level priorities
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

/**
 * Structured logger for ISL verification
 * 
 * Provides structured logging that integrates with Datadog log management:
 * - JSON-formatted logs
 * - Trace correlation
 * - Context propagation
 * - Level-based filtering
 * 
 * @example
 * ```typescript
 * const logger = new StructuredLogger(client, {
 *   minLevel: 'info',
 *   defaultContext: { service: 'verification' },
 * });
 * 
 * logger.info('Verification started', {
 *   domain: 'auth',
 *   behavior: 'login',
 * });
 * 
 * // With span correlation
 * logger.withSpan(span).info('Check passed', { checkType: 'precondition' });
 * ```
 */
export class StructuredLogger {
  private client: DatadogClient;
  private options: Required<LoggerOptions>;
  private context: LogContext = {};

  constructor(client: DatadogClient, options: LoggerOptions = {}) {
    this.client = client;
    this.options = {
      minLevel: options.minLevel ?? 'info',
      timestamps: options.timestamps ?? true,
      includeSource: options.includeSource ?? false,
      defaultContext: options.defaultContext ?? {},
      formatter: options.formatter ?? this.defaultFormatter.bind(this),
    };
  }

  /**
   * Log a debug message
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log('debug', message, attributes);
  }

  /**
   * Log an info message
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    this.log('info', message, attributes);
  }

  /**
   * Log a warning message
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log('warn', message, attributes);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | Record<string, unknown>): void {
    const attributes = error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : error;

    this.log('error', message, attributes);
  }

  /**
   * Log a critical message
   */
  critical(message: string, error?: Error | Record<string, unknown>): void {
    const attributes = error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : error;

    this.log('critical', message, attributes);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.client, this.options);
    childLogger.context = {
      ...this.options.defaultContext,
      ...this.context,
      ...context,
    };
    return childLogger;
  }

  /**
   * Create a logger bound to a span for trace correlation
   */
  withSpan(span: Span): StructuredLogger {
    return this.child({
      traceId: span.traceId,
      spanId: span.spanId,
    });
  }

  /**
   * Create a logger for a specific domain/behavior
   */
  forBehavior(domain: string, behavior: string): StructuredLogger {
    return this.child({ domain, behavior });
  }

  /**
   * Log verification start
   */
  logVerificationStart(domain: string, behavior: string, metadata?: Record<string, unknown>): void {
    this.info('Verification started', {
      domain,
      behavior,
      event: 'verification.start',
      ...metadata,
    });
  }

  /**
   * Log verification completion
   */
  logVerificationComplete(
    domain: string,
    behavior: string,
    verdict: string,
    score: number,
    duration: number
  ): void {
    this.info('Verification completed', {
      domain,
      behavior,
      event: 'verification.complete',
      verdict,
      score,
      duration,
    });
  }

  /**
   * Log a check result
   */
  logCheck(
    domain: string,
    behavior: string,
    checkType: string,
    passed: boolean,
    expression?: string
  ): void {
    const level = passed ? 'debug' : 'warn';
    this.log(level, `Check ${passed ? 'passed' : 'failed'}: ${checkType}`, {
      domain,
      behavior,
      event: 'check.result',
      checkType,
      passed,
      expression,
    });
  }

  /**
   * Log a violation
   */
  logViolation(
    domain: string,
    behavior: string,
    violationType: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    this.warn(`Violation detected: ${violationType}`, {
      domain,
      behavior,
      event: 'violation',
      violationType,
      violationMessage: message,
      ...details,
    });
  }

  /**
   * Log SLO breach
   */
  logSLOBreach(
    sloName: string,
    domain: string,
    target: number,
    current: number
  ): void {
    this.error('SLO breach detected', {
      domain,
      event: 'slo.breach',
      slo: sloName,
      target,
      current,
      gap: target - current,
    });
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.options.minLevel = level;
  }

  /**
   * Get current minimum log level
   */
  getLevel(): LogLevel {
    return this.options.minLevel;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private log(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: this.options.timestamps ? new Date() : undefined,
      domain: this.context.domain,
      behavior: this.context.behavior,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      attributes: {
        ...this.options.defaultContext,
        ...this.context,
        ...attributes,
      },
    };

    this.client.log(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.options.minLevel];
  }

  private defaultFormatter(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp?.toISOString(),
      level: entry.level,
      message: entry.message,
      dd: {
        trace_id: entry.traceId,
        span_id: entry.spanId,
      },
      isl: {
        domain: entry.domain,
        behavior: entry.behavior,
      },
      ...entry.attributes,
    });
  }
}

/**
 * Create a structured logger
 */
export function createLogger(client: DatadogClient, options?: LoggerOptions): StructuredLogger {
  return new StructuredLogger(client, options);
}

/**
 * Audit logger for compliance tracking
 */
export class AuditLogger {
  private logger: StructuredLogger;

  constructor(client: DatadogClient) {
    this.logger = new StructuredLogger(client, {
      minLevel: 'info',
      defaultContext: {
        audit: true,
        source: 'isl-verification',
      },
    });
  }

  /**
   * Log an audit event
   */
  logEvent(
    eventType: string,
    action: string,
    subject: { type: string; id: string },
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>
  ): void {
    this.logger.info(`Audit: ${eventType}`, {
      event: 'audit',
      eventType,
      action,
      subject,
      outcome,
      ...details,
    });
  }

  /**
   * Log verification audit
   */
  logVerification(
    domain: string,
    behavior: string,
    verdict: string,
    requestor?: string
  ): void {
    this.logEvent(
      'verification',
      'verify',
      { type: 'behavior', id: `${domain}.${behavior}` },
      verdict === 'verified' ? 'success' : 'failure',
      { domain, behavior, verdict, requestor }
    );
  }

  /**
   * Log configuration change
   */
  logConfigChange(
    configType: string,
    action: 'create' | 'update' | 'delete',
    changedBy: string,
    details?: Record<string, unknown>
  ): void {
    this.logEvent(
      'config_change',
      action,
      { type: 'config', id: configType },
      'success',
      { changedBy, ...details }
    );
  }
}

/**
 * Create an audit logger
 */
export function createAuditLogger(client: DatadogClient): AuditLogger {
  return new AuditLogger(client);
}
