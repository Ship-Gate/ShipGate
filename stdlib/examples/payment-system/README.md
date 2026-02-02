# Payment System Example

An e-commerce payment system demonstrating ISL payment modules.

## Features

- Order checkout with card payments
- Full and partial refunds
- Subscription management
- Webhook processing

## Modules Used

```isl
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"
import { CreateRefund, ProcessRefundIntent } from "@isl/stdlib/payments/process-refund"
import { CreateSubscription, CancelSubscription, ChangePlan } from "@isl/stdlib/payments/subscription-create"
import { ReceiveWebhook, ProcessWebhook, HandlePaymentSucceeded } from "@isl/stdlib/payments/webhook-handle"
```

## Key Behaviors

### Checkout
- `Checkout` - Process order payment
- `CancelOrder` - Cancel pending order

### Refunds
- `RequestRefund` - Customer refund request
- `AdminRefund` - Admin-initiated refund

### Subscriptions
- `SubscribeToPlan` - Create subscription
- `ChangePlanFlow` - Upgrade/downgrade
- `PauseSubscriptionFlow` - Pause billing

### Webhooks
- `StripeWebhookHandler` - Validate and route
- `HandlePaymentWebhook` - Payment events
- `HandleSubscriptionWebhook` - Subscription events

## Payment Flow

```
1. Customer adds items to cart
2. Customer initiates checkout
3. CreatePayment creates intent
4. ProcessPaymentIntent charges card
5. Order status updated to PAID
6. Confirmation email sent
```

## Webhook Flow

```
1. Stripe sends webhook
2. ReceiveWebhook validates signature
3. ProcessWebhook routes to handler
4. Handler updates local state
5. Customer notified if needed
```
