import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { signLicense, getFeaturesByTier } from '@/lib/jwt';
import type { Tier } from '@shipgate/shared';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    const tier = session.metadata?.tier as Tier;
    const email = session.metadata?.email || session.customer_email;

    if (!tier || !email) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

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

    return NextResponse.json({
      licenseKey,
      tier,
      email,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Success route error:', error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
