import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  
  const baseUrl = process.env.FRONTEND_URL
    || new URL(request.url).origin;
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${baseUrl}/api/auth/google/callback&` +
    `response_type=code&` +
    `scope=profile email&` +
    `state=${redirect}`;
  
  return NextResponse.redirect(googleAuthUrl);
}
