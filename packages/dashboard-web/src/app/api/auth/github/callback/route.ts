import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code: code!,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    const user = await userResponse.json();
    
    // Get user email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    const emails = await emailResponse.json();
    const primaryEmail = emails.find((email: any) => email.primary)?.email;
    
    // Create JWT
    const jwtToken = jwt.sign(
      { 
        id: user.id.toString(), 
        email: primaryEmail || `${user.login}@github.com`, 
        name: user.name || user.login, 
        avatar: user.avatar_url,
        provider: 'github'
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Redirect back to frontend with token
    return NextResponse.redirect(`${state}?token=${jwtToken}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(`${state}?error=auth_failed`);
  }
}
