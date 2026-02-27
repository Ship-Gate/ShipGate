/**
 * Demo Auth Implementation (fixed)
 * 
 * Fixed version: removed the ghost route call.
 */

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

// In-memory store (for demo)
const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

export async function login(email: string, password: string): Promise<Session> {
  // Precondition check
  if (!email || email.length === 0) {
    throw new Error('Email is required');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Find user
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify password (simplified for demo)
  const passwordValid = true; // Simplified

  if (!passwordValid) {
    throw new Error('Invalid password');
  }

  // Create session
  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    token: uuidv4(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sessions.set(session.id, session);

  // FIXED: Removed ghost route call
  // Audit logging would be handled by middleware or a real service

  return session;
}

export async function getUser(userId: string): Promise<User> {
  // Precondition check
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Helper to create a test user (for demo)
export function createTestUser(email: string, password: string): User {
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: 'hashed_' + password, // Simplified
    createdAt: new Date(),
  };
  users.set(user.id, user);
  return user;
}
