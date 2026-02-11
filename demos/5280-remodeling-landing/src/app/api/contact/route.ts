/**
 * POST /api/contact - Submit contact/quote request from landing page.
 * ISL: intent/5280-remodeling-landing.isl
 * BR-001: Rate limited | BR-002: Audit logged
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRateLimited } from '@/lib/rate-limit';
import { createLead } from '@/lib/store';
import { auditLogContact } from '@/lib/audit';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Valid email required'),
  phone: z
    .string()
    .optional()
    .refine((s) => !s || s === '' || (s.length >= 10 && s.length <= 20), {
      message: 'Phone must be 10-20 digits if provided',
    }),
  message: z.string().min(1, 'Message is required').max(2000),
  serviceInterest: z.string().optional(),
});

function sanitize(value: string): string {
  return value.replace(/[<>]/g, '').trim();
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { success: false, message: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { success: false, message: first?.message ?? 'Validation failed' },
      { status: 400 }
    );
  }

  const { name, email, phone, message, serviceInterest } = parsed.data;

  const lead = createLead({
    name: sanitize(name),
    email: sanitize(email),
    phone: phone ? sanitize(phone) : undefined,
    message: sanitize(message),
    serviceInterest: serviceInterest ? sanitize(serviceInterest) : undefined,
  });

  auditLogContact(lead.id, { serviceInterest: lead.serviceInterest });

  return NextResponse.json({
    success: true,
    message: 'Thank you! We will get back to you soon.',
  });
}
