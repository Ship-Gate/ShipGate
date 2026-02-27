# @intentos/stdlib-payments

ISL Payments Standard Library - PCI-compliant payment processing behaviors for IntentOS.

## Overview

This package provides a comprehensive payment processing library defined using ISL (Intent Specification Language) with TypeScript implementations. All behaviors include:

- Formal specifications with preconditions, postconditions, and invariants
- PCI DSS compliance requirements
- Chaos engineering scenarios
- Full observability (metrics, traces, logs)

## Installation

```bash
pnpm add @intentos/stdlib-payments
```

## Behaviors

### CreatePayment

Initiate a new payment with idempotency guarantees.

```typescript
import { createPayment, CreatePaymentConfig } from '@intentos/stdlib-payments';

const result = await createPayment({
  idempotencyKey: 'order-123-payment',
  amount: 99.99,
  currency: 'USD',
  paymentMethodToken: 'pm_card_xxx',
  capture: true,
}, config);

if (result.success) {
  console.log('Payment created:', result.data.id);
} else {
  console.error('Payment failed:', result.error.code);
}
```

### CapturePayment

Complete an authorized payment.

```typescript
import { capturePayment } from '@intentos/stdlib-payments';

const result = await capturePayment({
  paymentId: 'pay_xxx',
  idempotencyKey: 'capture-order-123',
  amount: 75.00, // Optional: partial capture
}, config);
```

### RefundPayment

Issue a full or partial refund.

```typescript
import { refundPayment } from '@intentos/stdlib-payments';

const result = await refundPayment({
  paymentId: 'pay_xxx',
  idempotencyKey: 'refund-order-123',
  amount: 25.00, // Optional: partial refund
  reason: 'Customer request',
}, config);
```

### ProcessWebhook

Handle payment provider webhooks with signature verification.

```typescript
import { processWebhook } from '@intentos/stdlib-payments';

const result = await processWebhook({
  provider: 'STRIPE',
  eventId: 'evt_xxx',
  eventType: 'payment_intent.succeeded',
  signature: req.headers['stripe-signature'],
  timestamp: new Date(),
  payload: req.body,
  headers: req.headers,
}, config);
```

## Payment Providers

Supported providers:

- **Stripe** - Full implementation
- **Braintree** - Interface defined
- **Adyen** - Interface defined
- **Square** - Interface defined

```typescript
import { StripeProvider, createProvider } from '@intentos/stdlib-payments';

const provider = new StripeProvider({
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
});

// Or use the factory
const provider = createProvider({
  type: 'stripe',
  config: { /* ... */ },
});
```

## PCI Compliance

This library is designed for PCI DSS compliance:

- **No raw card data storage** - Only tokenized payment methods
- **Audit logging** - All operations are logged (without sensitive data)
- **Encryption** - Sensitive data encrypted at rest
- **Signature verification** - All webhooks verified before processing

```typescript
import { PCICompliance, maskCardNumber } from '@intentos/stdlib-payments';

// Validate no raw card data in objects
const isCompliant = PCICompliance.validateNoRawCardData(logData);

// Mask card numbers for display
const masked = maskCardNumber('4242424242424242'); // ************4242
```

## Idempotency

All write operations support idempotency keys:

```typescript
import { IdempotencyManager, RedisIdempotencyManager } from '@intentos/stdlib-payments';

const idempotency = new RedisIdempotencyManager(redisClient, {
  prefix: 'payments:idem:',
  expirySeconds: 86400,
});
```

## Fraud Detection

Built-in fraud detection with configurable rules:

```typescript
import { createFraudDetector, defaultFraudRules } from '@intentos/stdlib-payments';

const fraudDetector = createFraudDetector(contextProvider, defaultFraudRules, {
  critical: 75, // Block transactions with risk score >= 75
  high: 50,
  medium: 25,
});
```

## Metrics

Prometheus-compatible metrics:

```typescript
import { MetricsCollector } from '@intentos/stdlib-payments';

const metrics = new MetricsCollector();

// After processing payments...
const prometheusOutput = metrics.toPrometheusFormat();
```

Available metrics:
- `payments_created_total` - Counter by status, currency
- `payment_latency_ms` - Histogram
- `payment_errors_total` - Counter by error_code
- `captures_total` - Counter by currency
- `refunds_total` - Counter by currency
- `webhooks_received_total` - Counter by provider, event_type
- `webhooks_processed_total` - Counter by provider, event_type, success

## ISL Specifications

The formal ISL specifications are in the `intents/` directory:

```
intents/
├── domain.isl        # Type definitions, enums, compliance types
├── payment.isl       # Payment and Refund entities
└── behaviors/
    ├── create.isl    # CreatePayment behavior
    ├── capture.isl   # CapturePayment behavior
    ├── refund.isl    # RefundPayment behavior
    └── webhook.isl   # ProcessWebhook behavior
```

Each behavior specification includes:
- **Actors** - Who can perform the action
- **Input/Output** - Data contracts with constraints
- **Preconditions** - What must be true before execution
- **Postconditions** - What must be true after execution
- **Invariants** - What must always be true
- **Temporal** - SLA requirements
- **Security** - Rate limits, authentication
- **Compliance** - PCI DSS, SOC2 requirements
- **Scenarios** - Test cases
- **Chaos** - Failure scenarios

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## License

MIT
