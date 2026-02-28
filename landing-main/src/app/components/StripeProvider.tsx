import { loadStripe } from '@stripe/stripe-js';

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'https://app.shipgate.dev';

let stripePromise: Promise<any> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
        'pk_live_51SxSuA7irSsrPUk9XAPMYhKXtkyUeCoSgKVzwCtbHWnbimjE6DRniOpE4WK8k3rhPuJraaBnLjkhuSaqniTLGsjL00EAGf5nZ5'
    );
  }
  return stripePromise;
}

export function redirectToCheckout(plan?: string) {
  const url = plan
    ? `${DASHBOARD_URL}/checkout?plan=${encodeURIComponent(plan)}`
    : `${DASHBOARD_URL}/checkout`;
  window.location.href = url;
}

export const STRIPE_PRICE_IDS = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_1T5NmB7irSsrPUk97mCDMfB2',
} as const;
