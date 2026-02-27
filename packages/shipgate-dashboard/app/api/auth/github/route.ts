import { NextRequest, NextResponse } from 'next/server';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;

export async function GET(req: NextRequest) {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.redirect(new URL('/?error=config', req.url));
  }

  const redirect = req.nextUrl.searchParams.get('redirect') || '/checkout';
  const state = Buffer.from(JSON.stringify({ redirect })).toString('base64url');

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${req.nextUrl.origin}/api/auth/github/callback`,
    scope: 'user:email read:user',
    state,
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
