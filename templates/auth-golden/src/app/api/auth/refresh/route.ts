/**
 * Golden Auth Template — POST /api/auth/refresh
 * Refresh token rotation: validate old token, issue new pair, invalidate old
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import {
  verifyRefreshToken,
  generateTokenPair,
  hashRefreshToken,
  cookieNames,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from '@/lib/auth';
import type { AuthUser } from '@/types/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(cookieNames.refresh)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token required', code: 'MISSING_TOKEN' },
        { status: 401 }
      );
    }

    try {
      await verifyRefreshToken(refreshToken);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      return NextResponse.json(
        { error: 'Refresh token not found or already used', code: 'TOKEN_REVOKED' },
        { status: 401 }
      );
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash } });
      return NextResponse.json(
        { error: 'Refresh token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    // Delete old refresh token (rotation)
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const authUser: AuthUser = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      name: storedToken.user.name,
      role: storedToken.user.role,
    };

    const tokens = await generateTokenPair(authUser);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(tokens.refreshToken),
        userId: storedToken.userId,
        expiresAt: tokens.refreshTokenExpiresAt,
      },
    });

    const response = NextResponse.json({
      user: authUser,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    });

    response.cookies.set(cookieNames.access, tokens.accessToken, getAccessCookieOptions());
    response.cookies.set(cookieNames.refresh, tokens.refreshToken, getRefreshCookieOptions());

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
