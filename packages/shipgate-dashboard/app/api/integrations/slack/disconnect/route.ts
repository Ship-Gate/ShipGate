import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { orgId?: string };
  const orgId = body.orgId ?? auth.orgIds[0];

  if (!orgId || !auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Invalid org' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  await prisma.slackConnection.deleteMany({ where: { orgId } });

  return NextResponse.json({ data: { disconnected: true } });
}
