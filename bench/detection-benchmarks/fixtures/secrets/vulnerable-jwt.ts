import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = 'my-super-secret-jwt-signing-key-do-not-share-2024';
const REFRESH_SECRET = 'refresh-token-secret-key-also-very-secret';
const API_ENCRYPTION_KEY = 'aes-256-encryption-key-32bytes!!';

interface UserPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'moderator';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateTokenPair(user: UserPayload): TokenPair {
  const accessToken = jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      role: user.role,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m', issuer: 'app-auth', audience: 'app-api' },
  );

  const refreshToken = jwt.sign(
    {
      sub: user.userId,
      type: 'refresh',
    },
    REFRESH_SECRET,
    { expiresIn: '7d', issuer: 'app-auth' },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
  };
}

export function verifyAccessToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'app-auth',
      audience: 'app-api',
    }) as jwt.JwtPayload;

    return {
      userId: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as UserPayload['role'],
    };
  } catch {
    return null;
  }
}

export function refreshAccessToken(refreshToken: string): string | null {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET, {
      issuer: 'app-auth',
    }) as jwt.JwtPayload;

    const newAccessToken = jwt.sign(
      {
        sub: decoded.sub,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '15m', issuer: 'app-auth', audience: 'app-api' },
    );

    return newAccessToken;
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const user = verifyAccessToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (req as Request & { user: UserPayload }).user = user;
  return next();
}

export function encryptSessionData(data: string): string {
  const crypto = require('crypto');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(API_ENCRYPTION_KEY),
    iv,
  );
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}
