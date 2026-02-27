import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const VALID_EVENTS = ['run.completed', 'verdict.no_ship', 'finding.critical'];

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    channelId: string;
    channelName: string;
    event: string;
  };

  if (!body.channelId || !body.channelName || !body.event) {
    return NextResponse.json(
      { error: 'channelId, channelName, and event are required' },
      { status: 400 }
    );
  }

  if (!VALID_EVENTS.includes(body.event)) {
    return NextResponse.json(
      { error: `event must be one of: ${VALID_EVENTS.join(', ')}` },
      { status: 400 }
    );
  }

  const conn = await prisma.slackConnection.findFirst({
    where: { orgId: { in: auth.orgIds } },
  });

  if (!conn) {
    return NextResponse.json(
      { error: 'Slack not connected' },
      { status: 400 }
    );
  }

  const rule = await prisma.slackNotificationRule.create({
    data: {
      connectionId: conn.id,
      channelId: body.channelId,
      channelName: body.channelName,
      event: body.event,
    },
  });

  return NextResponse.json({
    data: {
      id: rule.id,
      channelId: rule.channelId,
      channelName: rule.channelName,
      event: rule.event,
      enabled: rule.enabled,
    },
  });
}
