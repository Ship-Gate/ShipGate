import { NextRequest, NextResponse } from 'next/server';
import stripe from 'stripe';
import { headers } from 'next/headers';

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = (await headers()).get('stripe-signature') as string;
  
  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }
  
  let event;
  
  try {
    const stripeClient = getStripeClient();
    event = stripeClient.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as any;
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
  
  return NextResponse.json({ received: true });
}
