import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const conn = await prisma.slackConnection.findFirst({
    where: { orgId: { in: auth.orgIds } },
    select: { accessToken: true },
  });

  if (!conn) {
    return NextResponse.json({ data: { channels: [] } });
  }

  const token = decrypt(conn.accessToken);
  const res = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel&limit=200&exclude_archived=true',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = (await res.json()) as {
    ok: boolean;
    channels?: Array<{ id: string; name: string }>;
  };

  if (!data.ok) {
    return NextResponse.json({ data: { channels: [] } });
  }

  return NextResponse.json({
    data: {
      channels: (data.channels ?? []).map((c) => ({
        id: c.id,
        name: c.name,
      })),
    },
  });
}
