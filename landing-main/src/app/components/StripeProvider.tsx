import { loadStripe } from '@stripe/stripe-js';

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'https://app.shipgate.dev';

let stripePromise: Promise<any> | null = null;

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('VITE_STRIPE_PUBLISHABLE_KEY not set');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export function redirectToCheckout(plan?: string) {
  const target = plan || 'pro';
  window.location.href = `${DASHBOARD_URL}/checkout?plan=${encodeURIComponent(target)}`;
}

export const STRIPE_PRICE_IDS = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || '',
} as const;
