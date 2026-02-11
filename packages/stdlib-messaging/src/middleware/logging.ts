/**
 * Logging middleware
 */

import type { Middleware, ProduceContext, ConsumeContext } from '../types.js';
import type { HandlerResult } from '../types.js';

// ============================================================================
// LOGGING MIDDLEWARE
// ============================================================================

export interface LoggingOptions {
  /** Log level */
  level: LogLevel;
  
  /** Logger function */
  logger: (level: LogLevel, message: string, data?: any) => void;
  
  /** Whether to log message payloads */
  logPayloads?: boolean;
  
  /** Whether to log headers */
  logHeaders?: boolean;
  
  /** Maximum payload size to log (bytes) */
  maxPayloadSize?: number;
  
  /** Custom formatter */
  formatter?: LogFormatter;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  /** Timestamp */
  timestamp: number;
  
  /** Log level */
  level: LogLevel;
  
  /** Message */
  message: string;
  
  /** Context data */
  data?: any;
  
  /** Component */
  component: string;
  
  /** Message ID */
  messageId?: string;
  
  /** Queue name */
  queue?: string;
}

export type LogFormatter = (entry: LogEntry) => string;

// ============================================================================
// DEFAULT LOGGER
// ============================================================================

export const DefaultLogger = {
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data),
  info: (message: string, data?: any) => console.info(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data),
};

// ============================================================================
// LOGGING MIDDLEWARE IMPLEMENTATION
// ============================================================================

export class LoggingMiddleware implements Middleware {
  readonly name = 'logging';
  
  constructor(private readonly options: LoggingOptions) {}
  
  async produce(context: ProduceContext, next: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    // Log before produce
    this.log(LogLevel.INFO, 'Producing message', {
      messageId: context.message.id,
      queue: context.queue,
      contentType: context.message.contentType,
      payloadSize: this.getPayloadSize(context.message.payload),
      headers: this.options.logHeaders ? context.message.headers : undefined,
      payload: this.shouldLogPayload(context.message) ? context.message.payload : '[REDACTED]',
    });
    
    try {
      await next();
      
      // Log after successful produce
      this.log(LogLevel.INFO, 'Message produced successfully', {
        messageId: context.message.id,
        queue: context.queue,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Log error
      this.log(LogLevel.ERROR, 'Failed to produce message', {
        messageId: context.message.id,
        queue: context.queue,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }
  
  async consume(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult> {
    const startTime = Date.now();
    
    // Log before consume
    this.log(LogLevel.INFO, 'Consuming message', {
      messageId: context.message.id,
      queue: context.queue,
      contentType: context.message.contentType,
      deliveryCount: context.message.deliveryCount,
      payloadSize: this.getPayloadSize(context.message.payload),
      headers: this.options.logHeaders ? context.message.headers : undefined,
      payload: this.shouldLogPayload(context.message) ? context.message.payload : '[REDACTED]',
    });
    
    try {
      const result = await next();
      
      // Log after successful consume
      this.log(LogLevel.INFO, 'Message consumed successfully', {
        messageId: context.message.id,
        queue: context.queue,
        result,
        duration: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      // Log error
      this.log(LogLevel.ERROR, 'Failed to consume message', {
        messageId: context.message.id,
        queue: context.queue,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }
  
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      component: 'messaging',
      messageId: data?.messageId,
      queue: data?.queue,
    };
    
    const formattedMessage = this.options.formatter 
      ? this.options.formatter(entry)
      : this.defaultFormat(entry);
    
    this.options.logger(level, formattedMessage, data);
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.options.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }
  
  private shouldLogPayload(message: any): boolean {
    if (!this.options.logPayloads) {
      return false;
    }
    
    const maxSize = this.options.maxPayloadSize || 1024;
    return this.getPayloadSize(message.payload) <= maxSize;
  }
  
  private getPayloadSize(payload: any): number {
    try {
      return JSON.stringify(payload).length;
    } catch {
      return 0;
    }
  }
  
  private defaultFormat(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const parts = [
      timestamp,
      `[${entry.level.toUpperCase()}]`,
      entry.component,
      entry.message,
    ];
    
    if (entry.messageId) {
      parts.push(`(msg=${entry.messageId})`);
    }
    
    if (entry.queue) {
      parts.push(`(queue=${entry.queue})`);
    }
    
    return parts.join(' ');
  }
}

// ============================================================================
// STRUCTURED LOGGER
// ============================================================================

export class StructuredLogger {
  constructor(private readonly writer: (entry: LogEntry) => void) {}
  
  debug(message: string, data?: any): void {
    this.write(LogLevel.DEBUG, message, data);
  }
  
  info(message: string, data?: any): void {
    this.write(LogLevel.INFO, message, data);
  }
  
  warn(message: string, data?: any): void {
    this.write(LogLevel.WARN, message, data);
  }
  
  error(message: string, data?: any): void {
    this.write(LogLevel.ERROR, message, data);
  }
  
  private write(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      component: 'messaging',
    };
    
    if (data?.messageId) {
      entry.messageId = data.messageId;
    }
    
    if (data?.queue) {
      entry.queue = data.queue;
    }
    
    this.writer(entry);
  }
}

// ============================================================================
// LOG FORMATTERS
// ============================================================================

export const LogFormatters = {
  /**
   * JSON formatter
   */
  json: (entry: LogEntry): string => {
    return JSON.stringify(entry);
  },
  
  /**
   * Simple text formatter
   */
  simple: (entry: LogEntry): string => {
    const timestamp = new Date(entry.timestamp).toISOString();
    return `${timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;
  },
  
  /**
   * Detailed formatter
   */
  detailed: (entry: LogEntry): string => {
    const timestamp = new Date(entry.timestamp).toISOString();
    let output = `${timestamp} [${entry.level.toUpperCase()}] ${entry.component}: ${entry.message}`;
    
    if (entry.messageId) {
      output += ` (messageId: ${entry.messageId})`;
    }
    
    if (entry.queue) {
      output += ` (queue: ${entry.queue})`;
    }
    
    if (entry.data) {
      output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    return output;
  },
  
  /**
   * Colored console formatter (for development)
   */
  colored: (entry: LogEntry): string => {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
    };
    
    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';
    
    const timestamp = new Date(entry.timestamp).toISOString();
    return `${color}${timestamp} [${entry.level.toUpperCase()}] ${entry.message}${reset}`;
  },
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a logging middleware with default options
 */
export function createLoggingMiddleware(
  level: LogLevel = LogLevel.INFO,
  logger?: (level: LogLevel, message: string, data?: any) => void
): LoggingMiddleware {
  return new LoggingMiddleware({
    level,
    logger: logger || ((level, message, data) => {
      switch (level) {
        case LogLevel.DEBUG:
          DefaultLogger.debug(message, data);
          break;
        case LogLevel.INFO:
          DefaultLogger.info(message, data);
          break;
        case LogLevel.WARN:
          DefaultLogger.warn(message, data);
          break;
        case LogLevel.ERROR:
          DefaultLogger.error(message, data);
          break;
      }
    }),
    logPayloads: false,
    logHeaders: true,
    maxPayloadSize: 1024,
  });
}

/**
 * Create a logging middleware with custom options
 */
export function createCustomLoggingMiddleware(options: Partial<LoggingOptions>): LoggingMiddleware {
  return new LoggingMiddleware({
    level: LogLevel.INFO,
    logger: DefaultLogger.info,
    ...options,
  });
}

/**
 * Create a JSON logging middleware
 */
export function createJsonLoggingMiddleware(
  level: LogLevel = LogLevel.INFO,
  writer?: (entry: LogEntry) => void
): LoggingMiddleware {
  const structuredLogger = new StructuredLogger(
    writer || ((entry) => console.log(JSON.stringify(entry)))
  );
  
  return new LoggingMiddleware({
    level,
    logger: structuredLogger.write.bind(structuredLogger),
    logPayloads: true,
    logHeaders: true,
    formatter: LogFormatters.json,
  });
}
