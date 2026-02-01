/**
 * Auth utilities
 * 
 * Sample auth module for testing the audit engine.
 */

import { verify } from 'jsonwebtoken';

const JWT_SECRET = 'super-secret-key-123'; // Hardcoded secret - should be flagged

export interface Session {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export async function getSession(request: Request): Promise<Session | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  
  try {
    const decoded = verify(token, JWT_SECRET) as Session;
    return decoded;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  // No rate limiting - should be flagged
  const user = await findUserByEmail(email);
  if (!user) return null;

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return null;

  return createToken(user);
}

export function requireAuth(handler: Function) {
  return async (request: Request) => {
    const session = await getSession(request);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }
    return handler(request, session);
  };
}

export function hasRole(session: Session, role: string): boolean {
  return session.role === role;
}

// Stub functions for testing
async function findUserByEmail(email: string) {
  return { id: '1', email, passwordHash: 'hash' };
}

async function comparePassword(plain: string, hash: string) {
  return plain === hash;
}

function createToken(user: { id: string; email: string }) {
  return 'token';
}
