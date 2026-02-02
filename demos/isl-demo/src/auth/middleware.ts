/**
 * Auth Middleware
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Require authentication middleware
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Decode token (simplified for demo)
    const decoded = Buffer.from(token, 'base64').toString();
    const [email] = decoded.split(':');
    
    req.user = {
      id: '1',
      email,
      role: 'user',
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Require specific role
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
