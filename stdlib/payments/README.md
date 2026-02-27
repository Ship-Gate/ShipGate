# ISL Standard Library: Payments

Payment processing modules for ISL.

## Modules

### ProcessPayment
Core payment processing with support for multiple payment methods.

```isl
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"

behavior Checkout {
  step 1: CreatePayment(customer_id, amount: 99.99, currency: USD)
  step 2: ProcessPaymentIntent(payment_id: payment.id, card_id: card.id)
}
```

**Behaviors:**
- `CreatePayment` - Create payment intent
- `ProcessPaymentIntent` - Process the payment
- `CancelPayment` - Cancel pending payment
- `GetPayment` - Retrieve payment details
- `ListCustomerPayments` - List customer's payments

### ProcessRefund
Refund processing with partial refund support.

```isl
import { CreateRefund, ProcessRefundIntent } from "@isl/stdlib/payments/process-refund"

behavior IssueRefund {
  step 1: CreateRefund(payment_id, amount: 25.00, reason: CUSTOMER_REQUEST)
  step 2: ProcessRefundIntent(refund_id: refund.id)
}
```

**Behaviors:**
- `CreateRefund` - Create refund request
- `ProcessRefundIntent` - Process the refund
- `CancelRefund` - Cancel pending refund
- `GetRefund` - Retrieve refund details
- `ListPaymentRefunds` - List refunds for payment
- `CalculateRefundableAmount` - Get refundable amount

### SubscriptionCreate
Subscription lifecycle management.

```isl
import { CreateSubscription, CancelSubscription } from "@isl/stdlib/payments/subscription-create"

behavior Subscribe {
  step 1: CreateSubscription(customer_id, plan_id: "pro_monthly")
}
```

**Behaviors:**
- `CreateSubscription` - Create new subscription
- `CancelSubscription` - Cancel subscription
- `PauseSubscription` - Pause subscription
- `ResumeSubscription` - Resume paused subscription
- `ChangePlan` - Upgrade/downgrade plan
- `GetSubscription` - Retrieve subscription details
- `RenewSubscription` - Process renewal

### WebhookHandle
Payment provider webhook processing.

```isl
import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib/payments/webhook-handle"

behavior StripeWebhook {
  step 1: ReceiveWebhook(provider: STRIPE, payload, signature)
  step 2: ProcessWebhook(webhook_id: event.id)
}
```

**Behaviors:**
- `ReceiveWebhook` - Receive and validate webhook
- `ProcessWebhook` - Process webhook event
- `HandlePaymentSucceeded` - Handle payment success
- `HandlePaymentFailed` - Handle payment failure
- `HandleSubscriptionEvent` - Handle subscription events
- `HandleDisputeCreated` - Handle chargebacks
- `RetryFailedWebhook` - Retry failed webhook

## Supported Providers

- Stripe
- PayPal
- Square
- Adyen
- Braintree

## Security Features

All payment modules include:
- PCI DSS compliance
- Idempotency keys
- Signature verification
- Fraud detection hooks
- Audit logging
- Rate limiting

## Usage

```isl
domain ECommerce {
  import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"
  import { CreateSubscription } from "@isl/stdlib/payments/subscription-create"
  import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib/payments/webhook-handle"
  
  behavior PurchaseProduct {
    input {
      customer_id: UUID
      product_id: UUID
      card_id: UUID
    }
    
    step 1: validate_product(product_id)
    step 2: CreatePayment(
      customer_id: input.customer_id,
      amount: product.price,
      currency: USD,
      description: "Purchase: " + product.name
    )
    step 3: ProcessPaymentIntent(payment_id: payment.id, card_id: input.card_id)
  }
}
```
