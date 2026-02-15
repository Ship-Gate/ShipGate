/**
 * Golden Auth Template — Type definitions
 * AuthUser, TokenPair, JWTPayload
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
  type: 'access' | 'refresh';
}
