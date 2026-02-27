/**
 * Golden Auth Template — withAuth HOF for protected routes, role-based access
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import type { AuthUser } from '@/types/auth';

export type AllowedRoles = string[] | 'any';

export interface AuthContext {
  user: AuthUser;
  request: NextRequest;
}

export type AuthHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function that wraps a route handler with authentication.
 * Extracts access token from cookie, verifies it, and passes user to handler.
 * Optionally enforces role-based access.
 */
export function withAuth(
  handler: AuthHandler,
  options?: { roles?: AllowedRoles }
): (request: NextRequest) => Promise<NextResponse> {
  const allowedRoles = options?.roles ?? 'any';

  return async (request: NextRequest): Promise<NextResponse> => {
    const accessToken = request.cookies.get('auth_access')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'MISSING_TOKEN' },
        { status: 401 }
      );
    }

    try {
      const payload = await verifyAccessToken(accessToken);

      const user: AuthUser = {
        id: payload.sub,
        email: payload.email as string,
        name: '', // Not stored in JWT; fetch from DB if needed
        role: payload.role as string,
      };

      if (allowedRoles !== 'any' && !allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Forbidden', code: 'INSUFFICIENT_ROLE' },
          { status: 403 }
        );
      }

      return handler(request, { user, request });
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }
  };
}

/**
 * Convenience wrapper for admin-only routes
 */
export function withAdminAuth(handler: AuthHandler): (request: NextRequest) => Promise<NextResponse> {
  return withAuth(handler, { roles: ['ADMIN'] });
}
