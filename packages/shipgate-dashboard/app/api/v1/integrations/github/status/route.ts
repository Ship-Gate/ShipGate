import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { getGitHubConnections } from '@/lib/github';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const connections = await getGitHubConnections(auth.orgIds);

  return NextResponse.json({
    data: {
      connected: connections.length > 0,
      connections: connections.map((c) => ({
        id: c.id,
        orgId: c.orgId,
        login: c.login,
        avatarUrl: c.avatarUrl,
        scope: c.scope,
        createdAt: c.createdAt.toISOString(),
      })),
    },
  });
}
