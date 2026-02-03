/**
 * Test Fixtures - Failing Handlers
 * 
 * These fixtures intentionally violate ISL intent rules.
 * Fix recipes should transform them into passing code.
 */

// ============================================================================
// Fixture 1: Missing Rate Limit (intent/rate-limit-required)
// ============================================================================

export const FIXTURE_MISSING_RATE_LIMIT = `
import { NextRequest, NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  try {
    // BUG: Body is parsed without rate limit check first!
    const body = await request.json();
    
    // Business logic
    const result = await processLogin(body);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(input: unknown) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 2: Rate Limit After Body Parse (intent/rate-limit-required)
// ============================================================================

export const FIXTURE_RATE_LIMIT_WRONG_ORDER = `
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  try {
    // BUG: Body parsed BEFORE rate limit check!
    const body = await request.json();
    
    // Rate limit comes too late
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    
    const result = await processLogin(body);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(input: unknown) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 3: Missing Audit (intent/audit-required)
// ============================================================================

export const FIXTURE_MISSING_AUDIT = `
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    // BUG: No audit on rate limit path!
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    const result = await processLogin(body);
    
    // BUG: No audit on success path!
    return NextResponse.json(result);
  } catch (error) {
    // BUG: No audit on error path!
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(input: unknown) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 4: Wrong Audit Semantics (intent/audit-required)
// ============================================================================

export const FIXTURE_WRONG_AUDIT_SEMANTICS = `
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    // BUG: success: true on error path!
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    const result = await processLogin(body);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    // BUG: success: true on error path!
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(input: unknown) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 5: Console.log in Production (intent/no-pii-logging)
// ============================================================================

export const FIXTURE_CONSOLE_IN_PRODUCTION = `
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  // BUG: console.log in production!
  console.log('Request received', requestId);
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    console.warn('Rate limited', requestId);
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    
    // BUG: Logging PII!
    console.log('Login attempt for email:', body.email);
    console.debug('Password length:', body.password.length);
    
    const result = await processLogin(body);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    // BUG: console.error might contain PII
    console.error('Login failed', error);
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(input: unknown) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 6: Missing Input Validation (intent/input-validation)
// ============================================================================

export const FIXTURE_MISSING_INPUT_VALIDATION = `
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    
    // BUG: Using body directly without validation!
    const result = await processLogin(body.email, body.password);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(email: string, password: string) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 7: Validation Result Ignored (intent/input-validation)
// ============================================================================

export const FIXTURE_VALIDATION_RESULT_IGNORED = `
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  try {
    const body = await request.json();
    
    // BUG: Calling safeParse but not checking the result!
    const validationResult = LoginSchema.safeParse(body);
    
    // Using body directly instead of validationResult.data
    const result = await processLogin(body.email, body.password);
    
    await audit({ action: 'Login', success: true, requestId });
    return NextResponse.json(result);
  } catch (error) {
    await audit({ action: 'Login', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(email: string, password: string) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Fixture 8: Missing Encryption (intent/encryption-required)
// ============================================================================

export const FIXTURE_MISSING_ENCRYPTION = `
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  try {
    const body = await request.json();
    
    const validationResult = RegisterSchema.safeParse(body);
    if (!validationResult.success) {
      await audit({ action: 'Register', success: false, requestId });
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }
    
    const input = validationResult.data;
    
    // BUG: Storing password without hashing!
    const user = await db.user.create({
      data: {
        email: input.email,
        password: input.password,  // Plain text password!
      },
    });
    
    await audit({ action: 'Register', success: true, requestId });
    return NextResponse.json({ userId: user.id });
  } catch (error) {
    await audit({ action: 'Register', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`;

// ============================================================================
// Fixture 9: Hardcoded Encryption Key (intent/encryption-required)
// ============================================================================

export const FIXTURE_HARDCODED_KEY = `
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

// BUG: Hardcoded encryption key!
const encryptionKey = 'abc123def456ghi789jkl012mno345pq';

function encryptSSN(ssn: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, '1234567890123456');
  let encrypted = cipher.update(ssn, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
  try {
    const body = await request.json();
    
    // Encrypting but with hardcoded key
    const encryptedSSN = encryptSSN(body.ssn);
    
    const user = await db.user.create({
      data: {
        ssn: encryptedSSN,
      },
    });
    
    await audit({ action: 'StoreSSN', success: true, requestId });
    return NextResponse.json({ userId: user.id });
  } catch (error) {
    await audit({ action: 'StoreSSN', success: false, requestId });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`;

// ============================================================================
// Fixture 10: Multiple Violations (Combined)
// ============================================================================

export const FIXTURE_MULTIPLE_VIOLATIONS = `
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Missing requestId
  // Missing rate limit
  // Missing audit
  // Missing input validation
  
  console.log('Request received');  // PII logging
  
  try {
    const body = await request.json();
    
    console.log('Processing request for:', body.email);  // More PII logging
    
    // Using body directly without validation
    const result = await processLogin(body.email, body.password);
    
    // No audit on success
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);  // PII in error logs
    // No audit on error
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function processLogin(email: string, password: string) {
  return { token: 'abc123' };
}
`;

// ============================================================================
// Expected Results After Fix
// ============================================================================

/**
 * After applying fix recipes, code should:
 * 
 * 1. intent/rate-limit-required:
 *    - Have rateLimit import
 *    - Have rateLimit check BEFORE request.json()
 *    - Have audit on 429 path with success: false
 * 
 * 2. intent/audit-required:
 *    - Have auditAttempt helper function
 *    - Have audit calls on ALL return paths
 *    - Have success: false on error paths
 *    - Have success: true on success paths
 * 
 * 3. intent/no-pii-logging:
 *    - No console.* statements
 *    - safeLogger import if logging needed
 *    - redactPII helper if logging sensitive context
 * 
 * 4. intent/input-validation:
 *    - Have Zod import
 *    - Have schema definition
 *    - Have safeParse call
 *    - Check validationResult.success
 *    - Use validationResult.data not raw body
 * 
 * 5. intent/encryption-required:
 *    - Have bcrypt import for passwords
 *    - Have hashPassword helper
 *    - Store hashed password, not plain text
 *    - Use env variables for encryption keys
 */
