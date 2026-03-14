import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { orgId: string; domain: string };

  if (!body.orgId || !body.domain) {
    return NextResponse.json(
      { error: 'orgId and domain are required' },
      { status: 400 }
    );
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin']);
  if (roleErr) return roleErr;

  const domain = body.domain.toLowerCase().trim();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const existing = await prisma.org.findFirst({
    where: { ssoDomain: domain, id: { not: body.orgId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Domain is already claimed by another organization' },
      { status: 409 }
    );
  }

  const token = `shipgate-verify-${randomBytes(16).toString('hex')}`;

  await prisma.org.update({
    where: { id: body.orgId },
    data: {
      ssoDomain: domain,
      domainVerifyToken: token,
      domainVerified: false,
    },
  });

  auditLog(req, auth, 'domain.claimed', `org:${body.orgId}`, body.orgId, { domain });

  return NextResponse.json({
    ok: true,
    data: {
      domain,
      verifyToken: token,
      dnsRecord: `_shipgate-verify.${domain}`,
      instructions: `Add a TXT record for _shipgate-verify.${domain} with value: ${token}`,
    },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { orgId: string };
  if (!body.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin']);
  if (roleErr) return roleErr;

  const org = await prisma.org.findUnique({
    where: { id: body.orgId },
    select: { ssoDomain: true, domainVerifyToken: true },
  });

  if (!org?.ssoDomain || !org.domainVerifyToken) {
    return NextResponse.json(
      { error: 'No domain configured. Set a domain first.' },
      { status: 400 }
    );
  }

  let verified = false;
  try {
    const { resolve } = await import('dns/promises');
    const records = await resolve(`_shipgate-verify.${org.ssoDomain}`, 'TXT');
    const flat = records.flat();
    verified = flat.some((r) => r.includes(org.domainVerifyToken!));
  } catch {
    verified = false;
  }

  if (!verified) {
    return NextResponse.json(
      {
        ok: false,
        error: `TXT record not found. Add a TXT record for _shipgate-verify.${org.ssoDomain} with value: ${org.domainVerifyToken}`,
      },
      { status: 422 }
    );
  }

  await prisma.org.update({
    where: { id: body.orgId },
    data: { domainVerified: true },
  });

  auditLog(req, auth, 'domain.verified', `org:${body.orgId}`, body.orgId, {
    domain: org.ssoDomain,
  });

  return NextResponse.json({ ok: true, data: { domain: org.ssoDomain, verified: true } });
}
