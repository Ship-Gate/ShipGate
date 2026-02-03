/**
 * Next.js Login Route Handler
 * 
 * Implements behavioral contracts from ISL auth spec:
 * - Input validation (400)
 * - Rate limiting (429)
 * - Credential verification (401)
 * - Successful authentication (200)
 * 
 * Security invariants:
 * - Passwords are NEVER logged
 * - PII is redacted from logs
 * - Rate limits enforced per email and IP
 */

import { type NextRequest, NextResponse } from 'next/server';
import { safeLog, redactPII } from './safe-logging';

// ============================================================================
// Types
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginSuccess {
  session: {
    id: string;
    user_id: string;
    expires_at: string;
  };
  access_token: string;
}

export interface LoginError {
  code: string;
  message: string;
  retriable: boolean;
  retry_after?: number;
}

export type LoginResponse = 
  | { success: true; data: LoginSuccess }
  | { success: false; error: LoginError };

// ============================================================================
// Rate Limiting (In-memory for demo - use Redis in production)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitByEmail = new Map<string, RateLimitEntry>();
const rateLimitByIP = new Map<string, RateLimitEntry>();

const RATE_LIMIT_EMAIL = 10; // 10 per hour per email
const RATE_LIMIT_IP = 100;   // 100 per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

export function resetRateLimits(): void {
  rateLimitByEmail.clear();
  rateLimitByIP.clear();
}

function checkRateLimit(
  key: string,
  store: Map<string, RateLimitEntry>,
  limit: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// ============================================================================
// Validation
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export function validateLoginInput(input: unknown): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }

  const { email, password } = input as Record<string, unknown>;

  // Email validation
  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email must be a string' });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'Email format is invalid' });
  } else if (email.length > 254) {
    errors.push({ field: 'email', message: 'Email exceeds maximum length' });
  }

  // Password validation
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password must be a string' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({ field: 'password', message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({ field: 'password', message: `Password exceeds maximum length` });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Mock User Store (Replace with real DB in production)
// ============================================================================

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  failed_attempts: number;
}

const users = new Map<string, StoredUser>();

export function seedUser(user: StoredUser): void {
  users.set(user.email, user);
}

export function clearUsers(): void {
  users.clear();
}

export function getUser(email: string): StoredUser | undefined {
  return users.get(email);
}

export function updateUser(email: string, updates: Partial<StoredUser>): void {
  const user = users.get(email);
  if (user) {
    users.set(email, { ...user, ...updates });
  }
}

// Simple hash check (use bcrypt in production)
function verifyPassword(password: string, hash: string): boolean {
  // For demo: hash is just "hashed_" + password
  return hash === `hashed_${password}`;
}

// ============================================================================
// Session Generation
// ============================================================================

function generateSession(userId: string): LoginSuccess {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const accessToken = `at_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return {
    session: {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    },
    access_token: accessToken,
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    safeLog('warn', 'login_parse_error', { ip: redactPII(ip, 'ip') });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid JSON body',
          retriable: false,
        },
      },
      { status: 400 }
    );
  }

  // Validate input
  const validation = validateLoginInput(body);
  if (!validation.valid) {
    safeLog('info', 'login_validation_failed', {
      ip: redactPII(ip, 'ip'),
      errors: validation.errors.map(e => e.field), // Only log field names, not values
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors[0].message,
          retriable: true,
        },
      },
      { status: 400 }
    );
  }

  const { email, password } = body as LoginInput;

  // Check rate limit by IP first (wider net)
  const ipRateCheck = checkRateLimit(ip, rateLimitByIP, RATE_LIMIT_IP);
  if (!ipRateCheck.allowed) {
    safeLog('warn', 'login_rate_limited', {
      reason: 'ip_limit',
      ip: redactPII(ip, 'ip'),
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retriable: true,
          retry_after: ipRateCheck.retryAfter,
        },
      },
      { status: 429, headers: { 'Retry-After': String(ipRateCheck.retryAfter) } }
    );
  }

  // Check rate limit by email
  const emailRateCheck = checkRateLimit(email.toLowerCase(), rateLimitByEmail, RATE_LIMIT_EMAIL);
  if (!emailRateCheck.allowed) {
    safeLog('warn', 'login_rate_limited', {
      reason: 'email_limit',
      email: redactPII(email, 'email'),
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts. Please try again later.',
          retriable: true,
          retry_after: emailRateCheck.retryAfter,
        },
      },
      { status: 429, headers: { 'Retry-After': String(emailRateCheck.retryAfter) } }
    );
  }

  // Look up user
  const user = getUser(email.toLowerCase());
  if (!user) {
    safeLog('info', 'login_user_not_found', {
      email: redactPII(email, 'email'),
    });
    // Return same error as invalid password to prevent enumeration
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          retriable: true,
        },
      },
      { status: 401 }
    );
  }

  // Check user status
  if (user.status === 'LOCKED') {
    safeLog('warn', 'login_account_locked', {
      user_id: user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is locked. Please contact support.',
          retriable: true,
          retry_after: 900, // 15 minutes
        },
      },
      { status: 401 }
    );
  }

  if (user.status === 'INACTIVE') {
    safeLog('info', 'login_account_inactive', {
      user_id: user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is not active',
          retriable: false,
        },
      },
      { status: 401 }
    );
  }

  // Verify password - NEVER log the password
  if (!verifyPassword(password, user.password_hash)) {
    const newFailedAttempts = user.failed_attempts + 1;
    const shouldLock = newFailedAttempts >= 5;

    updateUser(email.toLowerCase(), {
      failed_attempts: newFailedAttempts,
      status: shouldLock ? 'LOCKED' : user.status,
    });

    safeLog('info', 'login_invalid_password', {
      user_id: user.id,
      failed_attempts: newFailedAttempts,
      locked: shouldLock,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          retriable: true,
        },
      },
      { status: 401 }
    );
  }

  // Success! Reset failed attempts and create session
  updateUser(email.toLowerCase(), {
    failed_attempts: 0,
  });

  const session = generateSession(user.id);

  safeLog('info', 'login_success', {
    user_id: user.id,
    session_id: session.session.id,
  });

  return NextResponse.json(
    { success: true, data: session },
    { status: 200 }
  );
}
