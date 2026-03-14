import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID?.trim();
const STRIPE_ENTERPRISE_PRICE_ID = process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim();

const PLAN_CONFIG = {
  pro: {
    envPriceId: STRIPE_PRO_PRICE_ID,
    name: 'ShipGate Pro',
    description: 'Pro dashboard access — unlimited verifications, priority support',
    unitAmount: 4900,
  },
  enterprise: {
    envPriceId: STRIPE_ENTERPRISE_PRICE_ID,
    name: 'ShipGate Enterprise',
    description: 'Enterprise access — SSO, RBAC, audit logs, API access, self-hosted',
    unitAmount: 14900,
  },
} as const;

type PlanKey = keyof typeof PLAN_CONFIG;

function parseSession(cookie: string | undefined): { email?: string; id?: string } | null {
  if (!cookie) return null;
  try {
    const json = Buffer.from(cookie, 'base64url').toString('utf8');
    const data = JSON.parse(json) as { email?: string; id?: string };
    return data?.email && data?.id ? data : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Billing not configured. Set STRIPE_SECRET_KEY.' },
      { status: 503 }
    );
  }

  const session = parseSession(req.cookies.get('shipgate-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body or invalid JSON — default to pro
  }

  const plan: PlanKey = body.plan === 'enterprise' ? 'enterprise' : 'pro';
  const config = PLAN_CONFIG[plan];

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const origin = req.nextUrl.origin;

    let priceId = config.envPriceId;

    if (!priceId) {
      const product = await stripe.products.create({
        name: config.name,
        description: config.description,
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: config.unitAmount,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      priceId = price.id;
    } else {
      try {
        await stripe.prices.retrieve(priceId);
      } catch {
        const product = await stripe.products.create({
          name: config.name,
          description: config.description,
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: config.unitAmount,
          currency: 'usd',
          recurring: { interval: 'month' },
        });
        priceId = price.id;
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/api/auth/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      customer_email: session.email ?? undefined,
      client_reference_id: session.id ?? undefined,
      allow_promotion_codes: true,
      metadata: { plan },
    });

    return NextResponse.json({ url: checkoutSession.url ?? '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
