import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    provider: string;
    orgId?: string;
    projectFilter?: string;
  };

  if (!body.provider || !['vercel', 'railway'].includes(body.provider)) {
    return NextResponse.json(
      { error: 'provider must be "vercel" or "railway"' },
      { status: 400 }
    );
  }

  const orgId = body.orgId ?? auth.orgIds[0];
  if (!orgId || !auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Invalid org' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const webhookSecret = randomBytes(32).toString('hex');
  const origin = req.nextUrl.origin;

  const provider = await prisma.deploymentProvider.upsert({
    where: { orgId_provider: { orgId, provider: body.provider } },
    create: {
      orgId,
      provider: body.provider,
      webhookSecret,
      projectFilter: body.projectFilter ?? null,
    },
    update: {
      webhookSecret,
      projectFilter: body.projectFilter ?? undefined,
    },
  });

  return NextResponse.json({
    data: {
      id: provider.id,
      provider: provider.provider,
      webhookUrl: `${origin}/api/webhooks/${body.provider}`,
      webhookSecret,
      projectFilter: provider.projectFilter,
    },
  });
}
