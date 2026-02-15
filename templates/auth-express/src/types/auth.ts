/**
 * Golden Auth Template (Express) — Auth types
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
  email?: string;
  role?: string;
  type?: string;
  exp?: number;
  iat?: number;
}
