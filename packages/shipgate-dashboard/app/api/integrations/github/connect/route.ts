import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

export async function GET(req: NextRequest) {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GitHub integration not configured' },
      { status: 503 }
    );
  }

  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId') ?? auth.orgIds[0];
  if (!orgId || !auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Invalid org' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const state = Buffer.from(
    JSON.stringify({ orgId, userId: auth.userId })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${req.nextUrl.origin}/api/integrations/github/callback`,
    scope: 'repo:status read:org',
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
