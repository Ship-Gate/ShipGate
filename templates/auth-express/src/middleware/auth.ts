/**
 * Golden Auth Template (Express) — JWT verification middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/auth.js';
import type { JWTPayload } from '../types/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }
  const token = auth.slice(7);
  verifyAccessToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    });
}
