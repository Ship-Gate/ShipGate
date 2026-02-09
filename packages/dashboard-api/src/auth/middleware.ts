/**
 * Authentication & authorization middleware for Express.
 *
 * Supports three auth methods (checked in order):
 *   1. API Key  — `X-Api-Key` header (CI/CLI)
 *   2. JWT      — `Authorization: Bearer <token>` (dashboard frontend)
 *   3. Basic    — `Authorization: Basic <base64>` (simple setups)
 */

import type { Request, Response, NextFunction } from 'express';
import type { User, Role, Permission } from './types.js';
import { PERMISSIONS } from './types.js';
import type { AuthRepository } from './repository.js';
import { verifyToken } from './jwt.js';

// ── Auth middleware factory (needs repository) ──────────────────────

export function createAuthMiddleware(authRepo: AuthRepository) {
  /**
   * Main authentication middleware.
   * Tries API Key → JWT Bearer → Basic Auth in order.
   * Attaches `req.user` on success or responds 401.
   */
  function authenticate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const authHeader = req.headers.authorization;

    // ── 1. API Key ────────────────────────────────────────────────
    if (apiKey) {
      const user = authRepo.validateApiKey(apiKey);
      if (!user) {
        res.status(401).json({ ok: false, error: 'Invalid API key' });
        return;
      }
      req.user = user;
      next();
      return;
    }

    // ── 2. JWT Bearer ─────────────────────────────────────────────
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = verifyToken(token);
        const user = authRepo.getUserById(payload.sub);
        if (!user) {
          res.status(401).json({ ok: false, error: 'User not found' });
          return;
        }
        req.user = user;
        next();
        return;
      } catch {
        res
          .status(401)
          .json({ ok: false, error: 'Invalid or expired token' });
        return;
      }
    }

    // ── 3. Basic Auth ─────────────────────────────────────────────
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString(
        'utf-8',
      );
      const colonIndex = decoded.indexOf(':');
      if (colonIndex === -1) {
        res
          .status(401)
          .json({ ok: false, error: 'Invalid Basic Auth format' });
        return;
      }

      const email = decoded.slice(0, colonIndex);
      const password = decoded.slice(colonIndex + 1);
      const user = authRepo.getUserByEmail(email);

      if (!user) {
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
        return;
      }

      authRepo
        .validatePassword(user.id, password)
        .then((valid) => {
          if (!valid) {
            res
              .status(401)
              .json({ ok: false, error: 'Invalid credentials' });
            return;
          }
          req.user = user;
          next();
        })
        .catch(() => {
          res
            .status(500)
            .json({ ok: false, error: 'Authentication error' });
        });
      return;
    }

    // ── No credentials provided ───────────────────────────────────
    res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  return { authenticate };
}

// ── Stateless authorization middleware ───────────────────────────────

/**
 * Restrict access to specific roles.
 * Must be placed AFTER `authenticate`.
 */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ ok: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Restrict access to a specific permission string.
 * Must be placed AFTER `authenticate`.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }

    const userPerms = PERMISSIONS[req.user.role] as readonly string[];
    if (!userPerms.includes(permission)) {
      res
        .status(403)
        .json({ ok: false, error: `Missing permission: ${permission}` });
      return;
    }

    next();
  };
}

// ── Data scoping ────────────────────────────────────────────────────

/**
 * Scope a query object so non-admin users only see their team's data.
 * Admins see everything; others get a `teams` filter attached.
 */
export function scopeQuery<T extends Record<string, unknown>>(
  user: User,
  query: T,
): T & { teams?: string[] } {
  if (user.role === 'admin') return query;
  return { ...query, teams: user.teams };
}
