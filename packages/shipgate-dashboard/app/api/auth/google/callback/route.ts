import { NextRequest, NextResponse } from 'next/server';
import { provisionUser } from '@/lib/provision-user';
import { auditLog } from '@/lib/audit';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
async function exchangeCode(code: string, origin: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${origin}/api/auth/google/callback`,
    }).toString(),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  return data.access_token || null;
}

async function fetchUser(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  return {
    id: user.sub,
    email: user.email ?? `${user.sub}@google.user`,
    name: user.name ?? 'User',
    avatar: user.picture,
    provider: 'google',
  };
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/?error=config', req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  let redirect = '/checkout';
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
      if (parsed.redirect) redirect = parsed.redirect;
    } catch {
      /* ignore */
    }
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', req.url));
  }

  const accessToken = await exchangeCode(code, req.nextUrl.origin);
  if (!accessToken) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }

  const user = await fetchUser(accessToken);
  if (!user) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }

  const dbUser = await provisionUser(user);

  auditLog(req, { userId: dbUser.id }, 'auth.login', undefined, undefined, {
    provider: 'google',
  });

  const isPro = dbUser.isPro;
  const finalRedirect = isPro ? '/dashboard' : redirect;

  const session = Buffer.from(JSON.stringify({ ...user, id: dbUser.id, isPro, at: Date.now() })).toString('base64url');
  const res = NextResponse.redirect(new URL(finalRedirect, req.url));
  res.cookies.set('shipgate-session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return res;
}
