/**
 * Golden Auth Template — POST /api/auth/logout
 * Refresh token invalidation (delete from DB)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { hashRefreshToken, cookieNames } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(cookieNames.refresh)?.value;

    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }

    const response = NextResponse.json({ success: true });

    // Clear cookies (must match path used when setting)
    response.cookies.set(cookieNames.access, '', { maxAge: 0, path: '/' });
    response.cookies.set(cookieNames.refresh, '', { maxAge: 0, path: '/' });

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
