/**
 * Test fixture: Broken route that needs healing
 *
 * Violations:
 * - Missing rate limiting
 * - Missing audit logging
 * - Console.log with potential PII
 * - Missing input validation
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // This is a violation: console.log with user data
  console.log('Processing payment:', body);
  
  // No validation!
  const { amount, userId, cardNumber } = body;
  
  // TODO: implement payment processing
  
  // Missing audit on success/failure
  return NextResponse.json({ success: true, transactionId: '12345' });
}
