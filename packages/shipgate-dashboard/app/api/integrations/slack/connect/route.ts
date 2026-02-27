import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;

export async function GET(req: NextRequest) {
  if (!SLACK_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Slack integration not configured' },
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
    client_id: SLACK_CLIENT_ID,
    scope: 'channels:read,chat:write,incoming-webhook',
    redirect_uri: `${req.nextUrl.origin}/api/integrations/slack/callback`,
    state,
  });

  return NextResponse.redirect(
    `https://slack.com/oauth/v2/authorize?${params.toString()}`
  );
}
