# @intentos/stdlib-billing

Billing and subscription management standard library for IntentOS. Provides comprehensive subscription lifecycle management, invoicing, usage-based billing, and payment processing with Stripe and Paddle adapters.

## Features

- **Subscription Management**: Create, update, cancel, pause/resume subscriptions
- **Plan Changes**: Upgrade/downgrade with proration support
- **Invoicing**: Create, finalize, pay, and void invoices
- **Usage-Based Billing**: Record and track metered usage
- **Payment Methods**: Manage customer payment methods
- **Webhooks**: Process billing provider webhooks
- **Multi-Provider**: Stripe and Paddle adapters

## Installation

```bash
pnpm add @intentos/stdlib-billing
```

## Quick Start

### Using Stripe

```typescript
import { createStripeBillingService } from '@intentos/stdlib-billing/stripe';

const billing = createStripeBillingService({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
});

// Create a subscription
const result = await billing.createSubscription({
  customerId: 'cus_xxx',
  planId: 'price_xxx',
  trialDays: 14,
});

console.log(`Subscription ${result.subscription.id} created`);
```

### Using Paddle

```typescript
import { createPaddleBillingService, PaddleBillingProvider } from '@intentos/stdlib-billing/paddle';

const billing = createPaddleBillingService({
  vendorId: process.env.PADDLE_VENDOR_ID!,
  apiKey: process.env.PADDLE_API_KEY!,
  environment: 'sandbox',
});

// Paddle uses checkout URLs for subscription creation
const provider = new PaddleBillingProvider({ ... });
const checkoutUrl = await provider.generateCheckoutUrl({
  planId: 'plan_123',
  customerEmail: 'user@example.com',
});
```

## ISL Specification

The complete ISL specification is in the `intents/` directory:

```
intents/
├── domain.isl              # Main domain with types and invariants
├── subscription.isl        # Subscription entity with lifecycle
├── invoice.isl             # Invoice entity and line items
├── payment-method.isl      # Payment method entity
└── behaviors/
    ├── create-subscription.isl  # CreateSubscription, UpdateSubscription
    ├── cancel-subscription.isl  # Cancel, Pause, Resume, Reactivate
    ├── change-plan.isl          # ChangePlan, PreviewPlanChange
    ├── process-invoice.isl      # CreateInvoice, PayInvoice, VoidInvoice
    └── usage-record.isl         # RecordUsage, GetUsageSummary
```

## Subscription Lifecycle

```
                    ┌─────────────┐
                    │  TRIALING   │
                    └──────┬──────┘
                           │ trial ends
                           ▼
    ┌──────────┐    ┌─────────────┐    ┌──────────┐
    │  PAUSED  │◄───│   ACTIVE    │───►│ PAST_DUE │
    └────┬─────┘    └──────┬──────┘    └────┬─────┘
         │                 │                 │
         │    resume       │ cancel          │ payment
         └────────────────►│◄────────────────┘ recovered
                           ▼
                    ┌─────────────┐
                    │  CANCELED   │
                    └─────────────┘
```

## Core Behaviors

### CreateSubscription

```isl
behavior CreateSubscription {
  input {
    customer_id: CustomerId
    plan_id: PlanId
    quantity: Int { min: 1 }?
    trial_days: Int { min: 0 }?
    coupon_code: String?
  }
  
  output {
    success: CreateSubscriptionResult
    errors { CUSTOMER_NOT_FOUND, PLAN_NOT_FOUND, PAYMENT_FAILED, ... }
  }
  
  temporal {
    response within 2.seconds (p99)
  }
}
```

### CancelSubscription

```isl
behavior CancelSubscription {
  input {
    subscription_id: SubscriptionId
    cancel_immediately: Boolean?
    reason: String?
  }
  
  postconditions {
    cancel_immediately implies result.status == CANCELED
    not cancel_immediately implies result.cancel_at_period_end == true
  }
}
```

### ChangePlan

```isl
behavior ChangePlan {
  input {
    subscription_id: SubscriptionId
    new_plan_id: PlanId
    proration_behavior: ProrationBehavior?
  }
  
  postconditions {
    success implies Subscription.lookup(input.subscription_id).plan_id == input.new_plan_id
  }
}
```

### RecordUsage (Metered Billing)

```isl
behavior RecordUsage {
  input {
    subscription_id: SubscriptionId
    quantity: Int { min: 1 }
    action: UsageAction?  // INCREMENT or SET
    idempotency_key: String?
  }
  
  temporal {
    response within 200.ms (p99)
  }
}
```

## API Reference

### BillingService

```typescript
class BillingService {
  // Subscriptions
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  getSubscription(subscriptionId: string): Promise<Subscription>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
  changePlan(input: ChangePlanInput): Promise<ChangePlanResult>;
  pauseSubscription(subscriptionId: string, resumesAt?: Date): Promise<Subscription>;
  resumeSubscription(subscriptionId: string): Promise<Subscription>;

  // Invoices
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  payInvoice(input: PayInvoiceInput): Promise<PayInvoiceResult>;
  voidInvoice(invoiceId: string): Promise<Invoice>;

  // Usage
  recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
  getUsageSummary(subscriptionId: string, periodStart?: Date, periodEnd?: Date): Promise<UsageSummary>;

  // Plans
  getPlan(planId: string): Promise<Plan>;
  listPlans(active?: boolean): Promise<Plan[]>;

  // Payment Methods
  attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;

  // Webhooks
  handleWebhook(payload: string, signature: string): Promise<WebhookEvent>;
}
```

## Error Handling

```typescript
import {
  BillingError,
  CustomerNotFoundError,
  PlanNotFoundError,
  SubscriptionNotFoundError,
  PaymentFailedError,
  PaymentMethodRequiredError,
  AlreadySubscribedError,
  InvalidCouponError,
} from '@intentos/stdlib-billing';

try {
  await billing.createSubscription({ ... });
} catch (error) {
  if (error instanceof PaymentFailedError) {
    console.log('Payment failed:', error.declineCode);
    // Retry if retriable
    if (error.retriable) {
      await retry();
    }
  }
}
```

## Webhook Handling

```typescript
// Express example
app.post('/webhooks/stripe', async (req, res) => {
  try {
    const event = await billing.handleWebhook(
      req.body,
      req.headers['stripe-signature']
    );

    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send('Webhook error');
  }
});
```

## Proration

When changing plans, proration determines how unused time on the current plan is credited:

```typescript
const result = await billing.changePlan({
  subscriptionId: 'sub_xxx',
  newPlanId: 'price_enterprise',
  prorationBehavior: 'create_prorations', // or 'none', 'always_invoice'
});

// result.prorations contains credit/debit line items
console.log('Proration amount:', result.prorations);
```

## Usage-Based Billing

For metered subscriptions:

```typescript
// Record usage
await billing.recordUsage({
  subscriptionId: 'sub_xxx',
  quantity: 1000,
  action: 'increment',
  idempotencyKey: 'unique-key-123', // Prevent duplicates
});

// Get usage summary
const summary = await billing.getUsageSummary('sub_xxx');
console.log('Total usage:', summary.totalUsage);
```

## Environment Variables

### Stripe
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Paddle
```env
PADDLE_VENDOR_ID=12345
PADDLE_API_KEY=xxx
PADDLE_WEBHOOK_SECRET=xxx
PADDLE_ENVIRONMENT=production
```

## Provider Comparison

| Feature | Stripe | Paddle |
|---------|--------|--------|
| Direct subscription creation | ✅ | ❌ (checkout flow) |
| Invoice creation | ✅ | ❌ (automatic) |
| Usage-based billing | ✅ | ✅ |
| Proration | ✅ | ✅ |
| Pause/Resume | ✅ | ✅ |
| Tax handling | Manual | Automatic (MoR) |

## License

MIT
