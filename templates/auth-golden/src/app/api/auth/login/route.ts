/**
 * Golden Auth Template — POST /api/auth/login
 * Credential validation, JWT pair generation
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db';
import { loginSchema } from '@/lib/validators/auth';
import {
  generateTokenPair,
  hashRefreshToken,
  cookieNames,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from '@/lib/auth';
import type { AuthUser } from '@/types/auth';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const tokens = await generateTokenPair(authUser);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(tokens.refreshToken),
        userId: user.id,
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
