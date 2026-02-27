import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

async function exchangeCode(code: string, origin: string) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${origin}/api/integrations/github/callback`,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
  };
  return { token: data.access_token ?? null, scope: data.scope ?? '' };
}

async function fetchGitHubUser(accessToken: string) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    login: string;
    avatar_url?: string;
  };
}

export async function GET(req: NextRequest) {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/dashboard?error=github_config', req.url)
    );
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL('/dashboard?error=github_no_code', req.url)
    );
  }

  let orgId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    orgId = parsed.orgId;
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?error=github_bad_state', req.url)
    );
  }

  const { token, scope } = await exchangeCode(code, req.nextUrl.origin);
  if (!token) {
    return NextResponse.redirect(
      new URL('/dashboard?error=github_auth_failed', req.url)
    );
  }

  const ghUser = await fetchGitHubUser(token);
  if (!ghUser) {
    return NextResponse.redirect(
      new URL('/dashboard?error=github_user_failed', req.url)
    );
  }

  await prisma.gitHubConnection.upsert({
    where: { orgId_login: { orgId, login: ghUser.login } },
    create: {
      orgId,
      login: ghUser.login,
      accessToken: encrypt(token),
      avatarUrl: ghUser.avatar_url,
      scope,
    },
    update: {
      accessToken: encrypt(token),
      avatarUrl: ghUser.avatar_url,
      scope,
    },
  });

  return NextResponse.redirect(new URL('/dashboard?github=connected', req.url));
}
