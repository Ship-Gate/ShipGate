import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export const PRICE_IDS = {
  team: process.env.STRIPE_PRICE_ID_TEAM || '',
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
};

export type PriceTier = 'team' | 'enterprise';
