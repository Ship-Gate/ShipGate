import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { signLicense } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('[webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.metadata?.email || '';
    const customerId = typeof session.customer === 'string' ? session.customer : '';

    if (email) {
      const token = signLicense({
        email,
        plan: 'pro',
        stripeCustomerId: customerId,
      });

      console.log(`[webhook] Pro license created for ${email}, token: ${token.slice(0, 20)}...`);
    }
  }

  return NextResponse.json({ received: true });
}
