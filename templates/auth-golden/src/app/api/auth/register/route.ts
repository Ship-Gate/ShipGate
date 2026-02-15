/**
 * Golden Auth Template — POST /api/auth/register
 * Zod validation, password hashing (bcrypt cost 12), duplicate check, JWT pair generation
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db';
import { registerSchema } from '@/lib/validators/auth';
import {
  generateTokenPair,
  hashRefreshToken,
  cookieNames,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from '@/lib/auth';
import type { AuthUser } from '@/types/auth';

const BCRYPT_COST = 12;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered', code: 'EMAIL_TAKEN' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
      },
    });

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

    const response = NextResponse.json(
      {
        user: authUser,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
      },
      { status: 201 }
    );

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
