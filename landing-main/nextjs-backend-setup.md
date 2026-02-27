# Next.js Backend Setup for ShipGate

This document outlines the required setup for the Next.js backend that will handle OAuth and Stripe for the ShipGate Vite frontend.

## 📁 Required Files for Next.js Backend

### 1. Environment Variables (.env.local)
```env
# OAuth Configuration
GOOGLE_CLIENT_ID=85538816089-fgohlm8etq6m0og47r35ml79g1qi4440.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GITHUB_CLIENT_ID=Iv23lihxUiasFOjoUjgs
GITHUB_CLIENT_SECRET=cafcc3c705e14f610b5b3eaed85444b82c0546af

# Session Configuration
SESSION_SECRET=sg_secure_session_2024_production_key_32chars_min
JWT_SECRET=sg_jwt_production_2024_secure_signing_key_32chars

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_live_51SxSuA7irSsrPUk9XAPMYhKXtkyUeCoSgKVzwCtbHWnbimjE6DRniOpE4WK8k3rhPuJraaBnLjkhuSaqniTLGsjL00EAGf5nZ5
STRIPE_SECRET_KEY=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
STRIPE_WEBHOOK_SECRET=whsec_LLTiKCfU0qTQirlYeapQp0qsxbU1UmL5

# Application Configuration
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=sg_secure_session_2024_production_key_32chars_min
FRONTEND_URL=https://your-netlify-site.netlify.app
```

### 2. OAuth API Routes

#### pages/api/auth/google.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { redirect } = req.query;
  const redirectUri = encodeURIComponent(`${process.env.NEXTAUTH_URL}/api/auth/google/callback?redirect=${redirect}`);
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${process.env.NEXTAUTH_URL}/api/auth/google/callback&` +
    `response_type=code&` +
    `scope=profile email&` +
    `state=${redirect}`;
  
  res.redirect(302, googleAuthUrl);
}
```

#### pages/api/auth/github.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { redirect } = req.query;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=${process.env.NEXTAUTH_URL}/api/auth/github/callback&` +
    `scope=user:email&` +
    `state=${redirect}`;
  
  res.redirect(302, githubAuthUrl);
}
```

#### pages/api/auth/google/callback.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
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
    res.redirect(`${state}?token=${jwtToken}`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${state}?error=auth_failed`);
  }
}
```

#### pages/api/auth/github/callback.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  
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
        code: code as string,
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
    res.redirect(`${state}?token=${jwtToken}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${state}?error=auth_failed`);
  }
}
```

### 3. User Profile API

#### pages/api/user/profile.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    res.json({ user: decoded });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 4. Stripe API Routes

#### pages/api/stripe/checkout.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import stripe from 'stripe';
import jwt from 'jsonwebtoken';

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { priceId, successUrl, cancelUrl } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: decoded.email,
      metadata: {
        userId: decoded.id,
      },
    });
    
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
```

#### pages/api/stripe/webhook.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import stripe from 'stripe';

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    return res.status(400).json({ error: 'No signature' });
  }
  
  let event;
  
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful:', session);
      // Update user's subscription status in database
      break;
    case 'invoice.payment_succeeded':
      console.log('Payment succeeded');
      break;
    case 'invoice.payment_failed':
      console.log('Payment failed');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
}
```

## 📦 Required Dependencies

```bash
npm install stripe jsonwebtoken next-auth
npm install --save-dev @types/jsonwebtoken
```

## 🚀 Deployment Notes

1. **Environment Variables**: Add all variables to Vercel dashboard
2. **OAuth Callback URLs**: 
   - Google: `https://your-vercel-app.vercel.app/api/auth/google/callback`
   - GitHub: `https://your-vercel-app.vercel.app/api/auth/github/callback`
3. **Stripe Webhook**: Set webhook URL to `https://your-vercel-app.vercel.app/api/stripe/webhook`

## 🔄 Flow Summary

1. User clicks OAuth on Vite frontend
2. Redirects to Next.js OAuth endpoint
3. OAuth provider redirects back to Next.js callback
4. Next.js creates JWT and redirects to Vite frontend
5. Vite frontend stores JWT and makes authenticated requests
6. All API calls go through Next.js backend
