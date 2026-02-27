import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json(
      { error: 'connectionId is required' },
      { status: 400 }
    );
  }

  const conn = await prisma.gitHubConnection.findUnique({
    where: { id: body.connectionId },
  });

  if (!conn || !auth.orgIds.includes(conn.orgId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, conn.orgId, ['admin']);
  if (roleErr) return roleErr;

  await prisma.gitHubConnection.delete({ where: { id: conn.id } });

  return NextResponse.json({ data: { disconnected: true } });
}
