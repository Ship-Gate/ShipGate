# Railway Backend Setup for ShipGate

This guide shows how to set up the Next.js backend on Railway to handle OAuth and Stripe for the ShipGate Vite frontend.

## 🚀 Railway Deployment Setup

### 1. Install Dependencies
```bash
cd packages/dashboard-web
npm install stripe jsonwebtoken @types/jsonwebtoken
```

### 2. Environment Variables for Railway
Add these to your Railway project environment variables:

```env
# OAuth Configuration
GOOGLE_CLIENT_ID=85538816089-fgohlm8etq6m0og47r35ml79g1qi4440.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GITHUB_CLIENT_ID=Iv23lihxUiasFOjoUjgs
GITHUB_CLIENT_SECRET=cafcc3c705e14f610b5b3eaed85444b82c0546af

# Session Configuration
JWT_SECRET=sg_jwt_production_2024_secure_signing_key_32chars

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_live_51SxSuA7irSsrPUk9XAPMYhKXtkyUeCoSgKVzwCtbHWnbimjE6DRniOpE4WK8k3rhPuJraaBnLjkhuSaqniTLGsjL00EAGf5nZ5
STRIPE_SECRET_KEY=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
STRIPE_WEBHOOK_SECRET=whsec_LLTiKCfU0qTQirlYeapQp0qsxbU1UmL5

# Application Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-netlify-site.netlify.app
```

### 3. Create API Routes

#### pages/api/auth/google.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { redirect } = req.query;
  const backendUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`;
  const redirectUri = encodeURIComponent(`https://${backendUrl}/api/auth/google/callback?redirect=${redirect}`);
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=https://${backendUrl}/api/auth/google/callback&` +
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
  const backendUrl = process.env.RAILWAY_PUBLIC_DOMAIN || `${process.env.RAILWAY_SERVICE_NAME}.up.railway.app`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=https://${backendUrl}/api/auth/github/callback&` +
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
        code: code as string,
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

### 4. Railway Configuration

#### railway.json (in root of dashboard-web)
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

#### pages/api/health.ts
```typescript
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'shipgate-backend'
  });
}
```

### 5. Deploy to Railway

1. **Push to GitHub** (if not already)
2. **Connect Railway** to your GitHub repo
3. **Select the dashboard-web package** as the service
4. **Add environment variables** in Railway dashboard
5. **Deploy** the service

### 6. Update OAuth Callback URLs

After deployment, update your OAuth apps:

**Google OAuth:**
- Authorized redirect URI: `https://your-app-name.up.railway.app/api/auth/google/callback`

**GitHub OAuth:**
- Authorization callback URL: `https://your-app-name.up.railway.app/api/auth/github/callback`

### 7. Update Frontend

Update your Vite frontend `.env`:
```
BACKEND_URL=https://your-app-name.up.railway.app
```

And update `netlify.toml`:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-app-name.up.railway.app/api/:splat"
  status = 200
```

### 8. Test the Flow

1. Click OAuth on Vite frontend
2. Should redirect to Railway backend
3. OAuth provider redirects back to Railway
4. Railway creates JWT and redirects to Vite
5. Vite stores token and makes authenticated requests

## 🎯 Benefits of Railway

- ✅ **Easy deployment** from GitHub
- ✅ **Automatic HTTPS** and custom domains
- ✅ **Environment variables** management
- ✅ **Logs and monitoring** built-in
- ✅ **Free tier** for small projects
- ✅ **Fast deployments** and rollbacks
