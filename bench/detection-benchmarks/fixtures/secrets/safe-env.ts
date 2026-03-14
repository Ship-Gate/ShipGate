import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  stripe: {
    secretKey: requireEnv('STRIPE_SECRET_KEY'),
    webhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
  },
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  email: {
    apiKey: requireEnv('SENDGRID_API_KEY'),
    fromAddress: process.env.EMAIL_FROM ?? 'noreply@example.com',
  },
} as const;

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

interface UserPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'moderator';
}

export function generateAccessToken(user: UserPayload): string {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      role: user.role,
      type: 'access',
    },
    config.jwt.accessSecret,
    { expiresIn: '15m', issuer: 'app-auth', audience: 'app-api' },
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: '7d', issuer: 'app-auth' },
  );
}

export function verifyAccessToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'app-auth',
      audience: 'app-api',
    }) as jwt.JwtPayload;

    return {
      userId: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as UserPayload['role'],
    };
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const user = verifyAccessToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (req as Request & { user: UserPayload }).user = user;
  return next();
}

export async function createCheckoutSession(
  priceId: string,
  customerId: string,
) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/cancel`,
  });
}
