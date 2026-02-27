import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { syncStripeStatus } from '@/lib/license';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    logger.warn('stripe.webhook.signature_failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info('stripe.webhook.unhandled', { type: event.type });
    }
  } catch (err) {
    logger.error('stripe.webhook.handler_error', {
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (!userId) {
    logger.warn('stripe.webhook.checkout_no_ref', { sessionId: session.id });
    return;
  }

  logger.info('stripe.webhook.checkout_completed', { userId, customerId });
  audit(
    { userId },
    'billing.subscription_changed',
    undefined,
    undefined,
    { source: 'stripe_webhook', event: 'checkout.session.completed', customerId }
  );
  await syncStripeStatus(userId, true, customerId ?? undefined);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    logger.warn('stripe.webhook.sub_updated_no_user', { customerId });
    return;
  }

  const isActive = sub.status === 'active' || sub.status === 'trialing';
  logger.info('stripe.webhook.sub_updated', { userId: user.id, status: sub.status, isActive });
  audit(
    { userId: user.id },
    'billing.subscription_changed',
    undefined,
    undefined,
    { source: 'stripe_webhook', event: 'customer.subscription.updated', status: sub.status, isActive }
  );
  await syncStripeStatus(user.id, isActive, customerId);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    logger.warn('stripe.webhook.sub_deleted_no_user', { customerId });
    return;
  }

  logger.info('stripe.webhook.sub_deleted', { userId: user.id });
  audit(
    { userId: user.id },
    'billing.subscription_changed',
    undefined,
    undefined,
    { source: 'stripe_webhook', event: 'customer.subscription.deleted' }
  );
  await syncStripeStatus(user.id, false, customerId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    logger.warn('stripe.webhook.invoice_paid_no_user', { customerId });
    return;
  }

  audit(
    { userId: user.id },
    'billing.invoice_paid',
    invoice.id,
    undefined,
    {
      source: 'stripe_webhook',
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    }
  );
}
