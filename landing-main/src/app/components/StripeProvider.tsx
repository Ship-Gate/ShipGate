import { loadStripe } from '@stripe/stripe-js';

let stripePromise: Promise<any> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');
  }
  return stripePromise;
}

export async function createCheckoutSession(priceId: string) {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://shipgate-backend.vercel.app';
    const response = await fetch(`${backendUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('shipgate_token')}`,
        'Origin': window.location.origin,
      },
      body: JSON.stringify({
        priceId,
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId, url } = await response.json();
    return { sessionId, url };
  } catch (error) {
    console.error('Stripe error:', error);
    throw error;
  }
}

export const STRIPE_PRICE_IDS = {
  starter: 'price_1placeholder_starter',
  pro: 'price_1placeholder_pro',
  enterprise: 'price_1placeholder_enterprise',
} as const;
