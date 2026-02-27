import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const rule = await prisma.slackNotificationRule.findUnique({
    where: { id: params.id },
    include: { connection: { select: { orgId: true } } },
  });

  if (!rule || !auth.orgIds.includes(rule.connection.orgId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, rule.connection.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  await prisma.slackNotificationRule.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { deleted: true } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { enabled?: boolean };

  const rule = await prisma.slackNotificationRule.findUnique({
    where: { id: params.id },
    include: { connection: { select: { orgId: true } } },
  });

  if (!rule || !auth.orgIds.includes(rule.connection.orgId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, rule.connection.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const updated = await prisma.slackNotificationRule.update({
    where: { id: params.id },
    data: { enabled: body.enabled ?? rule.enabled },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      channelId: updated.channelId,
      channelName: updated.channelName,
      event: updated.event,
      enabled: updated.enabled,
    },
  });
}
