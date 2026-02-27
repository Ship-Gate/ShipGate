// ============================================================================
// Fastify Adapter for stdlib-auth
// Provides JWT middleware and route handlers for Fastify
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { 
  AuthService, 
  LoginInput, 
  LoginOutput,
  LogoutInput,
  LogoutOutput,
  ValidateSessionInput,
  ValidateSessionOutput,
  RefreshTokenInput,
  RefreshTokenOutput
} from '../../implementations/typescript/index.js';
import { 
  AuthException, 
  AuthErrorCode 
} from '../../implementations/typescript/types.js';

// ============================================================================
// Types
// ============================================================================

export interface FastifyAuthOptions {
  authService: AuthService;
  jwtSecret: string;
  jwtExpiresIn?: string; // e.g., "15m", "1h"
  cookieName?: string;
  headerName?: string; // Default: "Authorization"
  cookieSecure?: boolean;
  cookieHttpOnly?: boolean;
  cookieSameSite?: 'strict' | 'lax' | 'none';
}

export interface AuthenticatedRequest extends FastifyRequest {
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
// JWT Middleware
// ============================================================================

/**
 * Fastify authentication middleware
 * Validates JWT token and attaches user/session to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
  options: FastifyAuthOptions
): Promise<void> {
  const { authService, headerName = 'Authorization' } = options;

  // Extract token from header
  const authHeader = request.headers[headerName.toLowerCase()];
  if (!authHeader || typeof authHeader !== 'string') {
    return reply.code(401).send({ 
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header' 
    });
  }

  // Parse Bearer token
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return reply.code(401).send({ 
      error: 'UNAUTHORIZED',
      message: 'Invalid authorization header format' 
    });
  }

  const token = match[1];

  // Validate session
  const result = await authService.validateSession({ sessionToken: token });

  if (!result.success) {
    const error = result.error;
    const statusCode = error.httpStatus || 401;
    return reply.code(statusCode).send({
      error: error.code,
      message: error.message
    });
  }

  // Attach user and session to request
  (request as AuthenticatedRequest).user = {
    id: result.data.user.id,
    email: result.data.user.email,
    roles: result.data.user.roles.map(r => r.toString())
  };
  (request as AuthenticatedRequest).session = {
    id: result.data.session.id,
    expiresAt: result.data.session.expiresAt
  };
}

/**
 * Fastify authorization middleware factory
 * Checks if user has required permission
 */
export function requirePermission(permission: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    options: FastifyAuthOptions
  ): Promise<void> => {
    const authReq = request as AuthenticatedRequest;
    
    if (!authReq.user) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Basic role check is implemented; AuthService integration is future enhancement.
    const hasPermission = authReq.user.roles.includes('admin') || 
                         authReq.user.roles.includes(permission);

    if (!hasPermission) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Permission '${permission}' required`
      });
    }
  };
}

/**
 * Fastify role-based authorization middleware factory
 */
export function requireRole(...roles: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    options: FastifyAuthOptions
  ): Promise<void> => {
    const authReq = request as AuthenticatedRequest;
    
    if (!authReq.user) {
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const hasRole = roles.some(role => authReq.user!.roles.includes(role));

    if (!hasRole) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `One of roles [${roles.join(', ')}] required`
      });
    }
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Login route handler
 */
export async function loginHandler(
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
  options: FastifyAuthOptions
): Promise<void> {
  const { authService } = options;
  const input = request.body;

  // Extract IP and user agent
  const ipAddress = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
  const userAgent = request.headers['user-agent'] || undefined;

  const result = await authService.login({
    ...input,
    ipAddress,
    userAgent
  });

  if (!result.success) {
    const error = result.error;
    const statusCode = error.httpStatus || 401;
    return reply.code(statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.data && { data: error.data })
    });
  }

  // Set cookie if configured
  if (options.cookieName) {
    reply.setCookie(options.cookieName, result.data.token, {
      httpOnly: options.cookieHttpOnly ?? true,
      secure: options.cookieSecure ?? true,
      sameSite: options.cookieSameSite ?? 'strict',
      expires: result.data.expiresAt,
      path: '/'
    });
  }

  return reply.code(200).send({
    user: result.data.user,
    session: {
      id: result.data.session.id,
      expiresAt: result.data.expiresAt
    },
    token: result.data.token,
    expiresAt: result.data.expiresAt
  });
}

/**
 * Logout route handler
 */
export async function logoutHandler(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  options: FastifyAuthOptions
): Promise<void> {
  const { authService } = options;
  const sessionId = request.session?.id;

  if (!sessionId) {
    return reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'No active session'
    });
  }

  const result = await authService.logout({
    sessionId,
    revokeAll: false
  });

  if (!result.success) {
    const error = result.error;
    const statusCode = error.httpStatus || 400;
    return reply.code(statusCode).send({
      error: error.code,
      message: error.message
    });
  }

  // Clear cookie if configured
  if (options.cookieName) {
    reply.clearCookie(options.cookieName, {
      path: '/'
    });
  }

  return reply.code(200).send({
    message: result.data.message,
    revokedCount: result.data.revokedCount
  });
}

/**
 * Refresh token route handler
 */
export async function refreshTokenHandler(
  request: FastifyRequest<{ Body: { refresh_token: string } }>,
  reply: FastifyReply,
  options: FastifyAuthOptions
): Promise<void> {
  const { authService } = options;
  const refreshToken = request.body.refresh_token;

  if (!refreshToken) {
    return reply.code(400).send({
      error: 'INVALID_INPUT',
      message: 'refresh_token is required'
    });
  }

  // Refresh token support is a future enhancement; AuthService does not yet expose refresh token APIs.
  return reply.code(501).send({
    error: 'NOT_IMPLEMENTED',
    message: 'Refresh token endpoint not yet implemented'
  });
}

/**
 * Get current user route handler
 */
export async function meHandler(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  return reply.code(200).send({
    user: request.user,
    session: request.session
  });
}

// ============================================================================
// Plugin Registration
// ============================================================================

/**
 * Register auth routes and middleware with Fastify
 */
export async function registerAuthPlugin(
  fastify: FastifyInstance,
  options: FastifyAuthOptions
): Promise<void> {
  // Login route (public)
  fastify.post('/auth/login', async (request, reply) => {
    return loginHandler(request as FastifyRequest<{ Body: LoginInput }>, reply, options);
  });

  // Logout route (protected)
  fastify.post('/auth/logout', {
    preHandler: async (request, reply) => {
      return authenticate(request, reply, options);
    }
  }, async (request, reply) => {
    return logoutHandler(request as AuthenticatedRequest, reply, options);
  });

  // Refresh token route (public)
  fastify.post('/auth/refresh', async (request, reply) => {
    return refreshTokenHandler(request as FastifyRequest<{ Body: { refresh_token: string } }>, reply, options);
  });

  // Get current user route (protected)
  fastify.get('/auth/me', {
    preHandler: async (request, reply) => {
      return authenticate(request, reply, options);
    }
  }, async (request, reply) => {
    return meHandler(request as AuthenticatedRequest, reply);
  });
}

export default registerAuthPlugin;
