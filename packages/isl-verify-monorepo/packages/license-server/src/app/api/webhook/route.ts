import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { signLicense, getFeaturesByTier } from '@/lib/jwt';
import type { Tier } from '@shipgate/shared';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      const tier = session.metadata.tier as Tier;
      const email = session.metadata.email;

      // Generate license
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year validity

      const repoCount = tier === 'enterprise' ? 999 : tier === 'team' ? 10 : 1;

      const licenseKey = signLicense({
        tier,
        email,
        expiresAt: expiresAt.toISOString(),
        repoCount,
        features: getFeaturesByTier(tier),
      });

      // TODO: Store license in database
      // TODO: Send email with license key

      console.log('License generated:', { email, tier, licenseKey });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
  }
}
