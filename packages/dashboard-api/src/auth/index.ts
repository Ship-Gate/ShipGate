/**
 * Auth module — authentication, authorization, and RBAC for the dashboard API.
 *
 * @example
 * ```ts
 * import { createAuthRepository, createAuthMiddleware, authorize } from './auth/index.js';
 *
 * const authRepo = createAuthRepository(db);
 * const { authenticate } = createAuthMiddleware(authRepo);
 *
 * app.use('/api/v1/reports', authenticate, authorize('admin', 'developer'), reportsRouter);
 * ```
 */

// Types
export type { Role, User, Permission, ApiKeyInfo } from './types.js';
export { ROLES, PERMISSIONS } from './types.js';

// Schema
export { AUTH_SCHEMA_SQL } from './schema.js';

// Password hashing
export { hashPassword, verifyPassword } from './passwords.js';

// JWT
export { createToken, verifyToken, type JwtPayload } from './jwt.js';

// Repository
export {
  createAuthRepository,
  type AuthRepository,
  type CreateUserInput,
} from './repository.js';

// Middleware
export {
  createAuthMiddleware,
  authorize,
  requirePermission,
  scopeQuery,
} from './middleware.js';
