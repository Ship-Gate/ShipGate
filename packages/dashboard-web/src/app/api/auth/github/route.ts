import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  
  const baseUrl = process.env.FRONTEND_URL
    || new URL(request.url).origin;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=${baseUrl}/api/auth/github/callback&` +
    `scope=user:email&` +
    `state=${redirect}`;
  
  return NextResponse.redirect(githubAuthUrl);
}
