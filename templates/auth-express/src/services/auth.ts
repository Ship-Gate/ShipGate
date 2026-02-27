/**
 * Golden Auth Template (Express) — Auth service (Register, Login, Logout, Refresh)
 */

import bcrypt from 'bcrypt';
import { prisma } from '../lib/db.js';
import {
  generateTokenPair,
  hashRefreshToken,
  verifyRefreshToken,
} from '../lib/auth.js';
import type { AuthUser } from '../types/auth.js';
import type { RegisterInput, LoginInput, RefreshInput } from '../validators/auth.js';

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    },
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
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
  return {
    user: authUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
  };
}

export async function logout(refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hash } });
  return { success: true };
}

export async function refresh(input: RefreshInput) {
  const payload = await verifyRefreshToken(input.refreshToken);
  const hash = hashRefreshToken(input.refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, userId: payload.sub },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const authUser: AuthUser = {
    id: stored.user.id,
    email: stored.user.email,
    name: stored.user.name,
    role: stored.user.role,
  };
  const tokens = await generateTokenPair(authUser);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(tokens.refreshToken),
      userId: stored.user.id,
      expiresAt: tokens.refreshTokenExpiresAt,
    },
  });
  return {
    user: authUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
  };
}
