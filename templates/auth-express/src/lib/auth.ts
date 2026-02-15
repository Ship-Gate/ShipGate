/**
 * Golden Auth Template (Express) — JWT sign/verify, token pair generation
 * Uses jose for JWT, 15min access / 7d refresh
 */

import * as jose from 'jose';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import type { AuthUser, TokenPair, JWTPayload } from '../types/auth.js';

const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function signAccessToken(user: AuthUser): Promise<string> {
  const secret = getSecret();
  const jti = randomBytes(16).toString('hex');
  return await new jose.SignJWT({
    email: user.email,
    role: user.role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(secret);
}

export async function signRefreshToken(user: AuthUser): Promise<string> {
  const secret = getSecret();
  const jti = randomBytes(16).toString('hex');
  return await new jose.SignJWT({
    email: user.email,
    role: user.role,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SEC}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload as unknown as JWTPayload;
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload as unknown as JWTPayload;
}

export async function generateTokenPair(user: AuthUser): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user),
  ]);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  };
}

export function hashRefreshToken(token: string): string {
  return hashToken(token);
}
