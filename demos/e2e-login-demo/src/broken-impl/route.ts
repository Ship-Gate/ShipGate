/**
 * INTENTIONALLY BROKEN LOGIN IMPLEMENTATION
 * 
 * This implementation has multiple violations that the healer will fix:
 * 
 * 1. ❌ Missing rate limiting (@intent rate-limit-required)
 * 2. ❌ Missing audit logging (@intent audit-required)
 * 3. ❌ PII logged to console (@intent no-pii-logging)
 * 4. ❌ Password logged (CRITICAL violation)
 * 5. ❌ No input validation
 * 6. ❌ Missing __isl_intents export
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Input schema (incomplete - missing constraints)
const LoginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

// In-memory user store (for demo)
const users = new Map<string, {
  id: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  failed_attempts: number;
}>();

// Seed a test user
users.set('test@example.com', {
  id: 'user_123',
  email: 'test@example.com',
  password_hash: 'hashed_ValidPass123!',
  status: 'ACTIVE',
  failed_attempts: 0,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // ❌ VIOLATION: Logging PII (email) and password!
    console.log('Login attempt:', body.email, body.password);
    
    // ❌ VIOLATION: No proper validation
    const input = LoginSchema.parse(body);
    
    // ❌ VIOLATION: No rate limiting check
    
    // Look up user
    const user = users.get(input.email);
    
    if (!user) {
      // ❌ VIOLATION: No audit logging
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }
    
    // Check account status
    if (user.status === 'LOCKED') {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: 'Account locked' } },
        { status: 401 }
      );
    }
    
    if (user.status === 'INACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Account inactive' } },
        { status: 401 }
      );
    }
    
    // Verify password (simplified for demo)
    const expectedHash = `hashed_${input.password}`;
    if (user.password_hash !== expectedHash) {
      user.failed_attempts++;
      
      if (user.failed_attempts >= 5) {
        user.status = 'LOCKED';
      }
      
      // ❌ VIOLATION: No audit logging
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 }
      );
    }
    
    // Success - create session
    user.failed_attempts = 0;
    
    const session = {
      id: `sess_${Date.now()}`,
      user_id: user.id,
      access_token: `token_${Math.random().toString(36).substring(2)}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    // ❌ VIOLATION: No audit logging
    
    return NextResponse.json({
      success: true,
      data: {
        session,
        access_token: session.access_token,
      },
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
        { status: 400 }
      );
    }
    
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
      { status: 500 }
    );
  }
}

// ❌ VIOLATION: Missing __isl_intents export
