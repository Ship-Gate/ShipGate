/**
 * Logger Utility - FIXED VERSION
 * 
 * ✅ PASSES:
 * - Proper structured logging
 * - Log level filtering
 * - PII redaction built-in
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// ✅ Structured logger (would use winston/pino in production)
class Logger {
  private level: LogLevel = 'info';
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(this.redact(context))}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  // ✅ REDACT SENSITIVE FIELDS
  private redact(context: LogContext): LogContext {
    const sensitiveKeys = ['password', 'ssn', 'creditCard', 'token', 'secret'];
    const redacted: LogContext = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else if (key.toLowerCase() === 'email' && typeof value === 'string') {
        redacted[key] = this.maskEmail(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    return `${local[0]}***@${domain}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      // ✅ Use proper logging transport, not console
      process.stdout.write(this.formatMessage('debug', message, context) + '\n');
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      process.stdout.write(this.formatMessage('info', message, context) + '\n');
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      process.stderr.write(this.formatMessage('warn', message, context) + '\n');
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      process.stderr.write(this.formatMessage('error', message, context) + '\n');
    }
  }
}

export const logger = new Logger();
