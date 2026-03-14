import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/sso-lookup — check if an email domain has SSO configured.
 * Public endpoint (no auth required).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ssoAvailable: false });
  }

  const domain = email.split('@')[1];
  const org = await prisma.org.findFirst({
    where: { ssoDomain: domain, ssoEnabled: true },
    select: { id: true, name: true, ssoEnforced: true },
  });

  if (!org) {
    return NextResponse.json({ ssoAvailable: false });
  }

  return NextResponse.json({
    ssoAvailable: true,
    ssoEnforced: org.ssoEnforced,
    orgId: org.id,
    orgName: org.name,
    loginUrl: `/api/auth/saml/login?tenant=${org.id}`,
  });
}
