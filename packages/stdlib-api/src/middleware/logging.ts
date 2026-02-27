// ============================================================================
// ISL Standard Library - Logging Middleware
// @isl-lang/stdlib-api
// ============================================================================

import type { Middleware } from '../types.js';

export interface LogEntry {
  method: string;
  url: string;
  status?: number;
  durationMs: number;
  error?: string;
  retryAttempt?: number;
}

export interface LoggingOptions {
  logger?: (entry: LogEntry) => void;
  logRequests?: boolean;
  logResponses?: boolean;
}

/**
 * Logging middleware. Logs request/response details via a pluggable logger.
 */
export function loggingMiddleware(options: LoggingOptions = {}): Middleware {
  const {
    logger = defaultLogger,
    logRequests = true,
    logResponses = true,
  } = options;

  return {
    name: 'logging',
    async execute(ctx, next) {
      const { method, url } = ctx.request;
      const start = Date.now();

      if (logRequests) {
        logger({ method, url, durationMs: 0 });
      }

      const result = await next(ctx);
      const durationMs = Date.now() - start;

      if (logResponses) {
        const entry: LogEntry = { method, url, durationMs };
        if (result.ok) {
          entry.status = result.value.status;
        } else {
          entry.error = result.error.message;
          entry.status = result.error.status;
        }
        const retryAttempt = ctx.metadata['retryAttempt'] as number | undefined;
        if (retryAttempt !== undefined) {
          entry.retryAttempt = retryAttempt;
        }
        logger(entry);
      }

      return result;
    },
  };
}

function defaultLogger(entry: LogEntry): void {
  const parts = [`[${entry.method}] ${entry.url}`];
  if (entry.status !== undefined) parts.push(`${entry.status}`);
  parts.push(`${entry.durationMs}ms`);
  if (entry.error) parts.push(`ERROR: ${entry.error}`);
  if (entry.retryAttempt !== undefined) parts.push(`retry #${entry.retryAttempt}`);
  // eslint-disable-next-line no-console
  console.log(parts.join(' | '));
}
