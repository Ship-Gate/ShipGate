import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY!);
const charge = await stripe.charges.create({ amount: 1000, currency: 'usd' });
