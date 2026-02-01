import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Payments - ISL Standard Library",
  description: "Pre-built payment processing specifications.",
};

export default function PaymentsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Payments</h1>

        <p className="lead text-xl text-muted-foreground">
          Complete payment processing specifications including charges, 
          refunds, and subscriptions.
        </p>

        <h2>Import</h2>

        <CodeBlock
          code={`import { Payment, Refund, Subscription, ProcessPayment, CreateRefund } from "@stdlib/payments"`}
          language="isl"
        />

        <h2>Entities</h2>

        <h3>Payment</h3>

        <CodeBlock
          code={`entity Payment {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  amount: Money
  currency: CurrencyCode [default: "USD"]
  status: PaymentStatus
  payment_method_id: UUID
  external_id: String? [unique]  # Stripe/PayPal ID
  description: String?
  metadata: Map<String, String>?
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  captured_at: Timestamp?
  failed_at: Timestamp?
  failure_reason: String?

  invariants {
    amount > 0
    status == CAPTURED implies captured_at != null
    status == FAILED implies failed_at != null
    status == FAILED implies failure_reason != null
  }

  lifecycle {
    PENDING -> AUTHORIZED
    AUTHORIZED -> CAPTURED
    AUTHORIZED -> CANCELLED
    CAPTURED -> REFUNDED
    CAPTURED -> PARTIALLY_REFUNDED
    PENDING -> FAILED
    AUTHORIZED -> FAILED
  }
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  FAILED
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}`}
          language="isl"
        />

        <h3>Refund</h3>

        <CodeBlock
          code={`entity Refund {
  id: UUID [immutable, unique]
  payment_id: UUID [immutable, indexed]
  amount: Money
  reason: RefundReason
  notes: String?
  status: RefundStatus
  external_id: String?
  created_at: Timestamp [immutable]
  processed_at: Timestamp?

  invariants {
    amount > 0
    amount <= Payment(payment_id).amount
    status == PROCESSED implies processed_at != null
  }
}

enum RefundReason {
  CUSTOMER_REQUEST
  DUPLICATE
  FRAUDULENT
  PRODUCT_NOT_RECEIVED
  PRODUCT_UNACCEPTABLE
  OTHER
}

enum RefundStatus {
  PENDING
  PROCESSED
  FAILED
}`}
          language="isl"
        />

        <h3>Subscription</h3>

        <CodeBlock
          code={`entity Subscription {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  plan_id: UUID [indexed]
  status: SubscriptionStatus
  price: Money
  currency: CurrencyCode
  billing_interval: BillingInterval
  current_period_start: Timestamp
  current_period_end: Timestamp
  trial_end: Timestamp?
  cancelled_at: Timestamp?
  cancel_at_period_end: Boolean [default: false]
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    price >= 0
    current_period_end > current_period_start
    status == TRIALING implies trial_end != null
    status == CANCELLED implies cancelled_at != null
  }

  lifecycle {
    TRIALING -> ACTIVE
    TRIALING -> CANCELLED
    ACTIVE -> PAST_DUE
    ACTIVE -> CANCELLED
    PAST_DUE -> ACTIVE
    PAST_DUE -> CANCELLED
    CANCELLED -> ACTIVE  # Reactivation
  }
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  UNPAID
}

enum BillingInterval {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
}`}
          language="isl"
        />

        <h2>Behaviors</h2>

        <h3>ProcessPayment</h3>

        <CodeBlock
          code={`behavior ProcessPayment {
  description: "Process a payment charge"

  actors {
    User { must: authenticated }
    System { for: recurring_billing }
  }

  input {
    amount: Money
    currency: CurrencyCode?
    payment_method_id: UUID
    description: String?
    capture: Boolean [default: true]
    idempotency_key: String?
  }

  output {
    success: Payment
    errors {
      INVALID_AMOUNT { when: "Amount invalid" }
      PAYMENT_METHOD_INVALID { when: "Card declined or expired" }
      INSUFFICIENT_FUNDS { when: "Not enough funds" }
      PROCESSOR_ERROR { when: "Payment processor error" }
    }
  }

  preconditions {
    input.amount > 0
    PaymentMethod.exists(input.payment_method_id)
    PaymentMethod.is_valid(input.payment_method_id)
  }

  postconditions {
    success implies {
      - Payment.exists(result.id)
      - result.amount == input.amount
      - result.status == (input.capture ? CAPTURED : AUTHORIZED)
    }
    failure implies {
      - no charge applied
    }
  }

  invariants {
    - idempotency key prevents duplicate charges
    - card details never logged
    - PCI DSS compliant
  }

  temporal {
    - within 3s (p99): response returned
    - eventually within 5s: receipt email sent
  }

  security {
    - rate_limit 100 per hour per user
  }
}`}
          language="isl"
        />

        <h3>CreateRefund</h3>

        <CodeBlock
          code={`behavior CreateRefund {
  description: "Refund a payment"

  actors {
    Admin { has_role: support }
    System { for: automatic_refund }
  }

  input {
    payment_id: UUID
    amount: Money?  # Defaults to full refund
    reason: RefundReason
    notes: String?
  }

  output {
    success: Refund
    errors {
      PAYMENT_NOT_FOUND { when: "Payment not found" }
      ALREADY_REFUNDED { when: "Payment already fully refunded" }
      AMOUNT_TOO_HIGH { when: "Refund amount exceeds payment" }
      REFUND_WINDOW_EXPIRED { when: "Past refund deadline" }
    }
  }

  preconditions {
    Payment.exists(input.payment_id)
    Payment(input.payment_id).status in [CAPTURED, PARTIALLY_REFUNDED]
    (input.amount ?? Payment(input.payment_id).amount) <= remaining_refundable_amount
  }

  postconditions {
    success implies {
      - Refund.exists(result.id)
      - result.payment_id == input.payment_id
      - Payment(input.payment_id).status in [REFUNDED, PARTIALLY_REFUNDED]
    }
  }

  temporal {
    - within 5s (p99): response returned
    - eventually within 5-10 business days: funds returned to customer
  }
}`}
          language="isl"
        />

        <h3>CreateSubscription</h3>

        <CodeBlock
          code={`behavior CreateSubscription {
  description: "Subscribe user to a plan"

  actors {
    User { must: authenticated }
  }

  input {
    plan_id: UUID
    payment_method_id: UUID
    coupon_code: String?
    trial_days: Int?
  }

  output {
    success: {
      subscription: Subscription
      first_invoice: Payment?
    }
    errors {
      PLAN_NOT_FOUND { when: "Plan doesn't exist" }
      ALREADY_SUBSCRIBED { when: "User already has active subscription" }
      PAYMENT_FAILED { when: "Initial payment failed" }
    }
  }

  preconditions {
    Plan.exists(input.plan_id)
    not User.has_active_subscription
    PaymentMethod.is_valid(input.payment_method_id)
  }

  postconditions {
    success implies {
      - Subscription.exists(result.subscription.id)
      - result.subscription.status in [TRIALING, ACTIVE]
      - trial_days > 0 implies result.subscription.status == TRIALING
    }
  }
}`}
          language="isl"
        />

        <h2>Using in Your App</h2>

        <CodeBlock
          code={`import { Payment, ProcessPayment } from "@stdlib/payments"
import { Money } from "@stdlib/core"

domain ECommerce {
  entity Order {
    id: UUID [immutable]
    user_id: UUID
    payment_id: UUID?
    total: Money
    status: OrderStatus
    
    invariants {
      status == PAID implies payment_id != null
    }
  }
  
  behavior CheckoutOrder {
    input {
      order_id: UUID
      payment_method_id: UUID
    }
    
    # Compose with stdlib payment
    steps {
      1. Validate order
      2. Call ProcessPayment(
           amount: Order(order_id).total,
           payment_method_id: input.payment_method_id
         )
      3. Update order with payment_id
    }
    
    postconditions {
      success implies {
        - Order(order_id).status == PAID
        - Payment.exists_for_order(order_id)
      }
    }
  }
}`}
          language="isl"
        />
      </div>
    </div>
  );
}
