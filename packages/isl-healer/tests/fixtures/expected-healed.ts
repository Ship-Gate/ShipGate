/**
 * Test fixture: Expected healed route
 *
 * This is what broken-route.ts should look like after healing.
 */

import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { z } from 'zod';

// @intent no-pii-logging - no sensitive data in logs
export async function POST(request: Request) {
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit({
    limit: 10,
    window: '60s',
    identifier: request.ip,
  });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const body = await request.json();
  
  // @intent input-validation
  const validationResult = InputSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validationResult.error.format() },
      { status: 400 }
    );
  }
  const input = validationResult.data;
  
  // No console.log - PII removed
  
  const { amount, userId, cardNumber } = input;
  
  // TODO: implement payment processing
  
    // @intent audit-required
    await audit({
      action: 'ProcessPayment',
      timestamp: new Date().toISOString(),
      success: true,
    });

  return NextResponse.json({ success: true, transactionId: '12345' });
}

// Machine-checkable intent declaration
export const __isl_intents = ["rate-limit-required", "audit-required", "no-pii-logging", "input-validation"] as const;
