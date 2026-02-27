import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { syncStripeStatus } from '@/lib/license';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId || !STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL('/checkout?error=invalid', req.url));
  }

  const existingSession = req.cookies.get('shipgate-session')?.value;
  if (!existingSession) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.redirect(new URL('/checkout?error=payment_pending', req.url));
    }

    const decoded = JSON.parse(Buffer.from(existingSession, 'base64url').toString('utf8'));
    const userId = decoded.id;

    // Persist isPro in DB (webhook may arrive later)
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (userId) {
      await syncStripeStatus(userId, true, customerId ?? undefined);
    }

    const updated = { ...decoded, isPro: true };
    const newCookie = Buffer.from(JSON.stringify(updated)).toString('base64url');

    const res = NextResponse.redirect(new URL('/dashboard', req.url));
    res.cookies.set('shipgate-session', newCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL('/checkout?error=verify_failed', req.url));
  }
}
