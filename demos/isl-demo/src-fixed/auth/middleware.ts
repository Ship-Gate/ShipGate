/**
 * Re-export auth middleware from main src for src-fixed API routes.
 */
export {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../../src/auth/middleware';
