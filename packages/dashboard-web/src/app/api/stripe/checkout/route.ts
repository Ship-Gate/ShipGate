import { NextRequest, NextResponse } from 'next/server';
import stripe from 'stripe';
import jwt from 'jsonwebtoken';

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { priceId, successUrl, cancelUrl } = body;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: decoded.email,
      metadata: {
        userId: decoded.id,
      },
    });
    
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
