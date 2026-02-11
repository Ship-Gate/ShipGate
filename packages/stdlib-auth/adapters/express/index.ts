// ============================================================================
// Express Adapter for stdlib-auth
// Provides JWT middleware and route handlers for Express
// ============================================================================

import type { Request, Response, NextFunction } from 'express';
import type { 
  AuthService, 
  LoginInput, 
  LoginOutput,
  LogoutInput,
  LogoutOutput,
  ValidateSessionInput,
  ValidateSessionOutput
} from '../../implementations/typescript/index.js';
import { 
  AuthException, 
  AuthErrorCode 
} from '../../implementations/typescript/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ExpressAuthOptions {
  authService: AuthService;
  jwtSecret: string;
  jwtExpiresIn?: string; // e.g., "15m", "1h"
  cookieName?: string;
  headerName?: string; // Default: "Authorization"
  cookieSecure?: boolean;
  cookieHttpOnly?: boolean;
  cookieSameSite?: 'strict' | 'lax' | 'none';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  session?: {
    id: string;
    expiresAt: Date;
  };
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Express authentication middleware
 * Validates JWT token and attaches user/session to request
 */
export function authenticate(options: ExpressAuthOptions) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { authService, headerName = 'Authorization' } = options;
    const authReq = req as AuthenticatedRequest;

    try {
      // Extract token from header
      const authHeader = req.headers[headerName.toLowerCase()];
      if (!authHeader || typeof authHeader !== 'string') {
        res.status(401).json({ 
          error: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header' 
        });
        return;
      }

      // Parse Bearer token
      const match = authHeader.match(/^Bearer (.+)$/);
      if (!match) {
        res.status(401).json({ 
          error: 'UNAUTHORIZED',
          message: 'Invalid authorization header format' 
        });
        return;
      }

      const token = match[1];

      // Validate session
      const result = await authService.validateSession({ sessionToken: token });

      if (!result.success) {
        const error = result.error;
        const statusCode = error.httpStatus || 401;
        res.status(statusCode).json({
          error: error.code,
          message: error.message
        });
        return;
      }

      // Attach user and session to request
      authReq.user = {
        id: result.data.user.id,
        email: result.data.user.email,
        roles: result.data.user.roles.map(r => r.toString())
      };
      authReq.session = {
        id: result.data.session.id,
        expiresAt: result.data.session.expiresAt
      };

      next();
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authentication middleware error'
      });
    }
  };
}

/**
 * Express authorization middleware factory
 * Checks if user has required permission
 */
export function requirePermission(permission: string, options: ExpressAuthOptions) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // Basic role check is implemented; AuthService integration is future enhancement.
    const hasPermission = authReq.user.roles.includes('admin') || 
                         authReq.user.roles.includes(permission);

    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Permission '${permission}' required`
      });
      return;
    }

    next();
  };
}

/**
 * Express role-based authorization middleware factory
 */
export function requireRole(...roles: string[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    const hasRole = roles.some(role => authReq.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `One of roles [${roles.join(', ')}] required`
      });
      return;
    }

    next();
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Login route handler
 */
export async function loginHandler(
  req: Request<{}, {}, LoginInput>,
  res: Response,
  options: ExpressAuthOptions
): Promise<void> {
  const { authService } = options;
  const input = req.body;

  try {
    // Extract IP and user agent
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || undefined;

    const result = await authService.login({
      ...input,
      ipAddress,
      userAgent
    });

    if (!result.success) {
      const error = result.error;
      const statusCode = error.httpStatus || 401;
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
        ...(error.data && { data: error.data })
      });
      return;
    }

    // Set cookie if configured
    if (options.cookieName) {
      res.cookie(options.cookieName, result.data.token, {
        httpOnly: options.cookieHttpOnly ?? true,
        secure: options.cookieSecure ?? true,
        sameSite: options.cookieSameSite ?? 'strict',
        expires: result.data.expiresAt,
        path: '/'
      });
    }

    res.status(200).json({
      user: result.data.user,
      session: {
        id: result.data.session.id,
        expiresAt: result.data.expiresAt
      },
      token: result.data.token,
      expiresAt: result.data.expiresAt
    });
  } catch (error) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Login handler error'
    });
  }
}

/**
 * Logout route handler
 */
export async function logoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  options: ExpressAuthOptions
): Promise<void> {
  const { authService } = options;
  const sessionId = req.session?.id;

  if (!sessionId) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'No active session'
    });
    return;
  }

  try {
    const result = await authService.logout({
      sessionId,
      revokeAll: false
    });

    if (!result.success) {
      const error = result.error;
      const statusCode = error.httpStatus || 400;
      res.status(statusCode).json({
        error: error.code,
        message: error.message
      });
      return;
    }

    // Clear cookie if configured
    if (options.cookieName) {
      res.clearCookie(options.cookieName, {
        path: '/'
      });
    }

    res.status(200).json({
      message: result.data.message,
      revokedCount: result.data.revokedCount
    });
  } catch (error) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Logout handler error'
    });
  }
}

/**
 * Refresh token route handler
 */
export async function refreshTokenHandler(
  req: Request<{}, {}, { refresh_token: string }>,
  res: Response,
  options: ExpressAuthOptions
): Promise<void> {
  const { authService } = options;
  const refreshToken = req.body.refresh_token;

  if (!refreshToken) {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'refresh_token is required'
    });
    return;
  }

  // Refresh token support is a future enhancement; AuthService does not yet expose refresh token APIs.
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Refresh token endpoint not yet implemented'
  });
}

/**
 * Get current user route handler
 */
export function meHandler(
  req: AuthenticatedRequest,
  res: Response
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
    return;
  }

  res.status(200).json({
    user: req.user,
    session: req.session
  });
}

// ============================================================================
// Route Registration Helper
// ============================================================================

/**
 * Register auth routes with Express app
 */
export function registerAuthRoutes(
  app: any, // Express app type
  options: ExpressAuthOptions
): void {
  const authMiddleware = authenticate(options);

  // Login route (public)
  app.post('/auth/login', async (req: Request<{}, {}, LoginInput>, res: Response) => {
    return loginHandler(req, res, options);
  });

  // Logout route (protected)
  app.post('/auth/logout', authMiddleware, async (req: Request, res: Response) => {
    return logoutHandler(req as AuthenticatedRequest, res, options);
  });

  // Refresh token route (public)
  app.post('/auth/refresh', async (req: Request<{}, {}, { refresh_token: string }>, res: Response) => {
    return refreshTokenHandler(req, res, options);
  });

  // Get current user route (protected)
  app.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
    return meHandler(req as AuthenticatedRequest, res);
  });
}
