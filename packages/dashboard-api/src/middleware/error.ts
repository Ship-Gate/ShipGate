import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '../types.js';

/**
 * Express error-handling middleware.
 * Must have 4 parameters so Express recognises it as an error handler.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500;
  const body: ApiError = {
    ok: false,
    error: status === 500 ? 'Internal server error' : err.message,
  };

  if (process.env['NODE_ENV'] !== 'production' && status === 500) {
    body.details = err.stack;
  }

  res.status(status).json(body);
}

/**
 * 404 catch-all — place after all route mounts.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ ok: false, error: 'Not found' });
}
