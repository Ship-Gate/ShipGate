import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID?.trim();

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
  if (!STRIPE_SECRET_KEY || !STRIPE_PRO_PRICE_ID) {
    return NextResponse.json(
      { error: 'Billing not configured. Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID.' },
      { status: 503 }
    );
  }

  const session = parseSession(req.cookies.get('shipgate-session')?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const origin = req.nextUrl.origin;

    let priceId = STRIPE_PRO_PRICE_ID;

    // If price doesn't exist or env not set, create product + price on-the-fly
    if (!priceId) {
      const product = await stripe.products.create({
        name: 'ShipGate Pro',
        description: 'Pro dashboard access — unlimited verifications, priority support',
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 1900,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      priceId = price.id;
    } else {
      // Verify price exists; if not, create it
      try {
        await stripe.prices.retrieve(priceId);
      } catch {
        const product = await stripe.products.create({
          name: 'ShipGate Pro',
          description: 'Pro dashboard access — unlimited verifications, priority support',
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 1900,
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
    });

    return NextResponse.json({ url: checkoutSession.url ?? '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
