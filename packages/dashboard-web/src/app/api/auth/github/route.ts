import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  const backendUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=https://${backendUrl}/api/auth/github/callback&` +
    `scope=user:email&` +
    `state=${redirect}`;
  
  return NextResponse.redirect(githubAuthUrl);
}
