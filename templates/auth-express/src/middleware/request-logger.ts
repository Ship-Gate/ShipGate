/**
 * Golden Auth Template (Express) — Request logging middleware
 */

import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}
