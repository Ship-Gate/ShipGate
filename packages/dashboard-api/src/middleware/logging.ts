import { Request, Response, NextFunction } from 'express';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  ip?: string;
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const colors = {
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  debug: '\x1b[35m',   // magenta
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

function formatLog(level: LogLevel, entry: LogEntry): string {
  const statusColor = entry.statusCode >= 400 ? colors.red : colors.green;
  const levelColor = colors[level];
  
  return [
    `${colors.dim}[${entry.timestamp}]${colors.reset}`,
    `${levelColor}${level.toUpperCase().padEnd(5)}${colors.reset}`,
    `${entry.method.padEnd(7)}`,
    `${entry.path}`,
    `${statusColor}${entry.statusCode}${colors.reset}`,
    `${colors.dim}${entry.duration}ms${colors.reset}`,
  ].join(' ');
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const output = meta 
    ? `${message} ${JSON.stringify(meta)}`
    : message;
  
  const formatted = `${colors.dim}[${timestamp}]${colors.reset} ${colors[level]}${level.toUpperCase().padEnd(5)}${colors.reset} ${output}`;
  
  if (level === 'error') {
    process.stderr.write(formatted + '\n');
  } else {
    process.stdout.write(formatted + '\n');
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, meta);
    }
  },
};

/**
 * Request logging middleware.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const { method, path, originalUrl } = req;
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method,
      path: originalUrl || path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.socket.remoteAddress,
    };

    const level: LogLevel = res.statusCode >= 500 
      ? 'error' 
      : res.statusCode >= 400 
        ? 'warn' 
        : 'info';

    process.stdout.write(formatLog(level, entry) + '\n');
  });

  next();
}

/**
 * Error logging middleware.
 */
export function errorLogger(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
    query: req.query,
  });
  
  next(err);
}
