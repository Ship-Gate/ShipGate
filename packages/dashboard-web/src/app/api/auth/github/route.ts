import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  
  // Use localhost for development, production URL for deployment
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shipgate-backend.vercel.app'
    : 'http://localhost:3000';
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=${baseUrl}/api/auth/github/callback&` +
    `scope=user:email&` +
    `state=${redirect}`;
  
  return NextResponse.redirect(githubAuthUrl);
}
