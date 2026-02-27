import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS, type PriceTier } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { tier, email } = await request.json();

    if (!tier || !email) {
      return NextResponse.json({ error: 'Missing tier or email' }, { status: 400 });
    }

    if (tier !== 'team' && tier !== 'enterprise') {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const priceId = PRICE_IDS[tier as PriceTier];
    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        tier,
        email,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
