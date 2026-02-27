import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;

export async function GET(req: NextRequest) {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/dashboard/team?error=slack_config', req.url)
    );
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/dashboard/team?error=slack_no_code', req.url)
    );
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    orgId = parsed.orgId;
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard/team?error=slack_bad_state', req.url)
    );
  }

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: `${req.nextUrl.origin}/api/integrations/slack/callback`,
    }),
  });

  const data = (await tokenRes.json()) as {
    ok: boolean;
    access_token?: string;
    team?: { id: string; name: string };
    bot_user_id?: string;
    error?: string;
  };

  if (!data.ok || !data.access_token || !data.team) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/team?error=slack_auth_failed&detail=${data.error ?? 'unknown'}`,
        req.url
      )
    );
  }

  await prisma.slackConnection.upsert({
    where: { orgId },
    create: {
      orgId,
      teamId: data.team.id,
      teamName: data.team.name,
      accessToken: encrypt(data.access_token),
      botUserId: data.bot_user_id,
    },
    update: {
      teamId: data.team.id,
      teamName: data.team.name,
      accessToken: encrypt(data.access_token),
      botUserId: data.bot_user_id,
    },
  });

  return NextResponse.redirect(
    new URL('/dashboard/team?slack=connected', req.url)
  );
}
