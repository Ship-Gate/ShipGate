/**
 * JWT Token Management
 */

import * as jose from 'jose';
import { v4 as uuid } from 'uuid';
import type { JWTConfig, AuthResult, TokenPayload } from './types';

/**
 * Create a JWT token
 */
export async function createToken(
  payload: Omit<TokenPayload, 'iss' | 'aud' | 'exp' | 'iat' | 'jti'>,
  config: JWTConfig,
  expiresIn: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload: TokenPayload = {
    ...payload,
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + expiresIn,
    jti: uuid(),
  };

  const alg = config.algorithm;

  if (alg.startsWith('HS')) {
    // Symmetric
    const secret = new TextEncoder().encode(config.secret!);
    return new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg })
      .sign(secret);
  } else {
    // Asymmetric
    const privateKey = await jose.importPKCS8(config.privateKey!, alg);
    return new jose.SignJWT(fullPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg })
      .sign(privateKey);
  }
}

/**
 * Verify a JWT token
 */
export async function verifyToken(
  token: string,
  config: JWTConfig
): Promise<AuthResult<TokenPayload>> {
  try {
    const alg = config.algorithm;
    let key: Uint8Array | jose.KeyLike;

    if (alg.startsWith('HS')) {
      key = new TextEncoder().encode(config.secret!);
    } else {
      key = await jose.importSPKI(config.publicKey!, alg);
    }

    const { payload } = await jose.jwtVerify(token, key, {
      issuer: config.issuer,
      audience: config.audience,
    });

    return {
      ok: true,
      data: payload as unknown as TokenPayload,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return {
        ok: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token is invalid',
      },
    };
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = jose.decodeJwt(token);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generate RSA key pair for asymmetric algorithms
 */
export async function generateKeyPair(
  algorithm: 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512'
): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = await jose.generateKeyPair(algorithm);
  
  return {
    publicKey: await jose.exportSPKI(publicKey),
    privateKey: await jose.exportPKCS8(privateKey),
  };
}

/**
 * Generate a secure secret for symmetric algorithms
 */
export function generateSecret(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}
