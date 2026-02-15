import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get('redirect');
  const backendUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`;
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=https://${backendUrl}/api/auth/google/callback&` +
    `response_type=code&` +
    `scope=profile email&` +
    `state=${redirect}`;
  
  return NextResponse.redirect(googleAuthUrl);
}
