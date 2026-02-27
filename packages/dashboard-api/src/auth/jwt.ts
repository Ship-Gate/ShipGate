/**
 * JWT token creation and verification for dashboard frontend auth.
 */

import jwt from 'jsonwebtoken';
import type { User } from './types.js';

/** Default token lifetime: 24 hours (in seconds). */
const DEFAULT_EXPIRY_SECONDS = 86_400;

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

/** Payload embedded in every JWT. */
export interface JwtPayload {
  sub: string;   // user.id
  email: string;
  role: string;
  teams: string[];
  iat?: number;
  exp?: number;
}

/** Create a signed JWT for the given user. */
export function createToken(
  user: User,
  expiresInSeconds: number = DEFAULT_EXPIRY_SECONDS,
): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    teams: user.teams,
  };
  return jwt.sign(payload, getSecret(), { expiresIn: expiresInSeconds });
}

/** Verify and decode a JWT. Throws on invalid/expired tokens. */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
