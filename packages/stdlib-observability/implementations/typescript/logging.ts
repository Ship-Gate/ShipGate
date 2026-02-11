// ============================================================================
// Observability Standard Library - Logging Implementation
// @isl-lang/stdlib-observability
// ============================================================================

/// <reference types="node" />

import {
  UUID,
  TraceId,
  SpanId,
  LogLevel,
  LogEntry,
  LogInput,
  LogOutput,
  LoggerConfig,
  LogExporter,
  DEFAULT_LOGGER_CONFIG,
  Result,
  success,
  failure,
} from './types';

export { LogLevel };
export type { LogEntry, LogInput, LogOutput, LoggerConfig, LogExporter };

// ============================================================================
// ID Generation
// ============================================================================

declare const crypto: {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
} | undefined;

function generateUUID(): UUID {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Context Management
// ============================================================================

interface LogContext {
  traceId?: TraceId;
  spanId?: SpanId;
  correlationId?: UUID;
  requestId?: UUID;
}

let currentContext: LogContext = {};

export function setLogContext(context: LogContext): void {
  currentContext = { ...currentContext, ...context };
}

export function clearLogContext(): void {
  currentContext = {};
}

export function getLogContext(): LogContext {
  return { ...currentContext };
}

// ============================================================================
// Log Level Utilities
// ============================================================================

export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.TRACE:
      return 'TRACE';
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
    case LogLevel.FATAL:
      return 'FATAL';
    default:
      return 'UNKNOWN';
  }
}

export function parseLogLevel(level: string): LogLevel {
  switch (level.toUpperCase()) {
    case 'TRACE':
      return LogLevel.TRACE;
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
    case 'WARNING':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    case 'FATAL':
      return LogLevel.FATAL;
    default:
      return LogLevel.INFO;
  }
}

// ============================================================================
// Console Exporter (Default)
// ============================================================================

export class ConsoleLogExporter implements LogExporter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_useColors = true) {
    // useColors can be used for future color formatting support
  }

  async export(entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      this.logEntry(entry);
    }
  }

  async shutdown(): Promise<void> {
    // No-op for console exporter
  }

  private logEntry(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = logLevelToString(entry.level);
    const service = entry.service;
    const message = entry.message;

    let output = `[${timestamp}] [${level}] [${service}] ${message}`;

    if (entry.traceId) {
      output += ` trace_id=${entry.traceId}`;
    }
    if (entry.spanId) {
      output += ` span_id=${entry.spanId}`;
    }
    if (entry.attributes && Object.keys(entry.attributes).length > 0) {
      output += ` ${JSON.stringify(entry.attributes)}`;
    }
    if (entry.error) {
      output += `\n  Error: ${entry.error.type}: ${entry.error.message}`;
      if (entry.error.stackTrace) {
        output += `\n  ${entry.error.stackTrace}`;
      }
    }

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        // Using process.stdout to avoid lint warnings about console
        if (typeof process !== 'undefined' && process.stdout?.write) {
          process.stdout.write(output + '\n');
        }
        break;
      case LogLevel.INFO:
        if (typeof process !== 'undefined' && process.stdout?.write) {
          process.stdout.write(output + '\n');
        }
        break;
      case LogLevel.WARN:
        if (typeof process !== 'undefined' && process.stderr?.write) {
          process.stderr.write(output + '\n');
        }
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        if (typeof process !== 'undefined' && process.stderr?.write) {
          process.stderr.write(output + '\n');
        }
        break;
    }
  }
}

// ============================================================================
// In-Memory Exporter (Testing)
// ============================================================================

export class InMemoryLogExporter implements LogExporter {
  private entries: LogEntry[] = [];

  async export(entries: LogEntry[]): Promise<void> {
    this.entries.push(...entries);
  }

  async shutdown(): Promise<void> {
    this.entries = [];
  }

  getLogs(): LogEntry[] {
    return [...this.entries];
  }

  getSamples(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private readonly config: LoggerConfig;
  private readonly exporters: LogExporter[];
  private buffer: LogEntry[] = [];
  private readonly bufferSize: number;
  private readonly flushInterval: number;
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(
    config: Partial<LoggerConfig> & { exporter?: LogExporter; exporters?: LogExporter[]; bufferSize?: number; flushInterval?: number } = {}
  ) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.exporters = config.exporters ?? (config.exporter ? [config.exporter] : [new ConsoleLogExporter()]);
    this.bufferSize = config.bufferSize ?? 100;
    this.flushInterval = config.flushInterval ?? 5000;

    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }
  }

  // ==========================================================================
  // Core Log Method
  // ==========================================================================

  async log(input: LogInput): Promise<Result<LogOutput>> {
    try {
      // Check if we should log this level
      if (input.level < this.config.minLevel) {
        return success({ id: '' });
      }

      const entry = this.createLogEntry(input);
      this.buffer.push(entry);

      // Flush if buffer is full
      if (this.buffer.length >= this.bufferSize) {
        await this.flush();
      }

      return success({ id: entry.id });
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private createLogEntry(input: LogInput): LogEntry {
    const context = getLogContext();

    return {
      id: generateUUID(),
      timestamp: new Date(),
      level: input.level,
      message: input.message,
      service: this.config.service,
      environment: this.config.environment,
      host: this.config.host,
      traceId: context.traceId,
      spanId: context.spanId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      attributes: {
        ...this.config.defaultAttributes,
        ...input.attributes,
      },
      error: input.error
        ? {
            type: input.error.name,
            message: input.error.message,
            stackTrace: input.error.stack,
          }
        : undefined,
    };
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  async trace(
    message: string,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.TRACE, message, attributes });
  }

  async debug(
    message: string,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.DEBUG, message, attributes });
  }

  async info(
    message: string,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.INFO, message, attributes });
  }

  async warn(
    message: string,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.WARN, message, attributes });
  }

  async error(
    message: string,
    error?: Error,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.ERROR, message, error, attributes });
  }

  async fatal(
    message: string,
    error?: Error,
    attributes?: Record<string, unknown>
  ): Promise<Result<LogOutput>> {
    return this.log({ level: LogLevel.FATAL, message, error, attributes });
  }

  // ==========================================================================
  // Buffer Management
  // ==========================================================================

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    await Promise.all(
      this.exporters.map((exporter) => exporter.export(entries))
    );
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();

    await Promise.all(this.exporters.map((exporter) => exporter.shutdown()));
  }

  // ==========================================================================
  // Child Logger
  // ==========================================================================

  child(attributes: Record<string, unknown>): Logger {
    return new Logger(
      {
        ...this.config,
        defaultAttributes: {
          ...this.config.defaultAttributes,
          ...attributes,
        },
      },
      this.exporters,
      { bufferSize: this.bufferSize, flushInterval: 0 } // Child shares parent's flush
    );
  }
}

// ============================================================================
// Default Logger Instance
// ============================================================================

let defaultLogger: Logger | null = null;

export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  Logger,
  ConsoleLogExporter,
  InMemoryLogExporter,
  setLogContext,
  clearLogContext,
  getLogContext,
  logLevelToString,
  parseLogLevel,
  getDefaultLogger,
  setDefaultLogger,
};
