import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'user' | 'viewer';
  };
}

/**
 * Simple API key authentication middleware.
 * In production, replace with proper JWT or OAuth2.
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  
  // Skip auth in development mode if no API key is configured
  if (process.env.NODE_ENV === 'development' && !process.env.API_KEY) {
    req.user = { id: 'dev-user', role: 'admin' };
    return next();
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key',
    });
    return;
  }

  if (apiKey !== process.env.API_KEY) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
    });
    return;
  }

  // In production, decode the API key to get user info
  req.user = { id: 'api-user', role: 'admin' };
  next();
}

/**
 * Role-based authorization middleware.
 */
export function authorize(...allowedRoles: Array<'admin' | 'user' | 'viewer'>) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no auth provided.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey && apiKey === process.env.API_KEY) {
    req.user = { id: 'api-user', role: 'admin' };
  } else if (process.env.NODE_ENV === 'development') {
    req.user = { id: 'dev-user', role: 'admin' };
  }

  next();
}
