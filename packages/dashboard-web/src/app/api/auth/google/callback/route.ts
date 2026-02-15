import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  try {
    const backendUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`;
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code!,
        grant_type: 'authorization_code',
        redirect_uri: `https://${backendUrl}/api/auth/google/callback`,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    const user = await userResponse.json();
    
    // Create JWT
    const jwtToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        avatar: user.picture,
        provider: 'google'
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Redirect back to frontend with token
    return NextResponse.redirect(`${state}?token=${jwtToken}`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${state}?error=auth_failed`);
  }
}
