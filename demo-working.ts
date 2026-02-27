import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

export async function login(email: string, password: string): Promise<Session> {
  if (!email || email.length === 0) {
    throw new Error('Email is required');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    throw new Error('User not found');
  }

  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    token: uuidv4(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  sessions.set(session.id, session);
  return session;
}

export async function getUser(userId: string): Promise<User> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

export function createTestUser(email: string, password: string): User {
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: 'hashed_' + password,
    createdAt: new Date(),
  };
  users.set(user.id, user);
  return user;
}
