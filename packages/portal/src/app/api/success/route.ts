import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { signLicense } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
    }

    const email = session.customer_email || session.metadata?.email || '';
    const customerId = typeof session.customer === 'string' ? session.customer : '';

    const token = signLicense({
      email,
      plan: 'pro',
      stripeCustomerId: customerId,
    });

    return NextResponse.json({ token, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
