import { createHash } from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

const users = new Map<string, User>();

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function generateId(): string {
  return createHash('sha256').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 36);
}

export type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: 'EMAIL_EXISTS' | 'INVALID_EMAIL' | 'WEAK_PASSWORD' };

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<RegisterResult> {
  if (!input.email.includes('@')) {
    return { success: false, error: 'INVALID_EMAIL' };
  }
  if (input.password.length < 8) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }
  const existing = Array.from(users.values()).find(u => u.email === input.email);
  if (existing) {
    return { success: false, error: 'EMAIL_EXISTS' };
  }
  const user: User = {
    id: generateId(),
    email: input.email,
    name: input.name,
    passwordHash: hashPassword(input.password),
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.set(user.id, user);
  return { success: true, user };
}

export type GetUserResult =
  | { success: true; user: User }
  | { success: false; error: 'NOT_FOUND' | 'FORBIDDEN' };

export async function getUser(input: {
  id: string;
  callerId: string;
  callerRole: string;
}): Promise<GetUserResult> {
  const user = users.get(input.id);
  if (!user) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (input.callerId !== input.id && input.callerRole !== 'admin') {
    return { success: false, error: 'FORBIDDEN' };
  }
  return { success: true, user };
}

export function _resetForTests() {
  users.clear();
}
