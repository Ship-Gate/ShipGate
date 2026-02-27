import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const conn = await prisma.slackConnection.findFirst({
    where: { orgId: { in: auth.orgIds } },
    include: { notifications: true },
  });

  if (!conn) {
    return NextResponse.json({
      data: { connected: false, connection: null, rules: [] },
    });
  }

  return NextResponse.json({
    data: {
      connected: true,
      connection: {
        id: conn.id,
        teamName: conn.teamName,
        createdAt: conn.createdAt.toISOString(),
      },
      rules: conn.notifications.map((r: { id: string; channelId: string; channelName: string; event: string; enabled: boolean }) => ({
        id: r.id,
        channelId: r.channelId,
        channelName: r.channelName,
        event: r.event,
        enabled: r.enabled,
      })),
    },
  });
}
