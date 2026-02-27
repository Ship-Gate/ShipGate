/**
 * Mock auth middleware for test fixtures
 */

import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  
  // Mock user
  (req as AuthenticatedRequest).user = {
    id: 'user-1',
    role: 'USER',
  };
  
  next();
}
