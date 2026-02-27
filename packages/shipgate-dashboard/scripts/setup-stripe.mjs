#!/usr/bin/env node
/**
 * Creates ShipGate Pro product and $19/mo price via Stripe API.
 * Run: node --env-file=.env.local scripts/setup-stripe.mjs
 * Requires STRIPE_SECRET_KEY in .env.local (get from https://dashboard.stripe.com/apikeys)
 */

import Stripe from 'stripe';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

// Load .env.local if --env-file wasn't used
if (!process.env.STRIPE_SECRET_KEY && existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^STRIPE_SECRET_KEY=(.+)$/);
    if (match) {
      process.env.STRIPE_SECRET_KEY = match[1].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key || key.startsWith('sk_live_')) {
  console.error('STRIPE_SECRET_KEY must be set in .env.local (use a test key sk_test_...)');
  process.exit(1);
}

const stripe = new Stripe(key);

async function main() {
  console.log('Creating ShipGate Pro product...');
  const product = await stripe.products.create({
    name: 'ShipGate Pro',
    description: 'Pro dashboard access — unlimited verifications, priority support',
  });
  console.log('  Product ID:', product.id);

  console.log('Creating $19/mo price...');
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1900, // $19.00
    currency: 'usd',
    recurring: { interval: 'month' },
  });
  console.log('  Price ID:', price.id);

  // Update .env.local
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const priceLine = `STRIPE_PRO_PRICE_ID=${price.id}`;
  if (content.includes('STRIPE_PRO_PRICE_ID=')) {
    content = content.replace(/STRIPE_PRO_PRICE_ID=.*/m, priceLine);
  } else {
    content = content.trimEnd() + (content ? '\n' : '') + '\n# Stripe (created by setup-stripe.mjs)\n' + priceLine + '\n';
  }
  writeFileSync(envPath, content);
  console.log('\nUpdated .env.local with STRIPE_PRO_PRICE_ID=' + price.id);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
