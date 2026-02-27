# Payment System Example
# Demonstrates payment modules for an e-commerce system

domain PaymentSystem version "1.0.0"

import { CreatePayment, ProcessPaymentIntent, CancelPayment, GetPayment } from "@isl/stdlib/payments/process-payment"
import { CreateRefund, ProcessRefundIntent, CalculateRefundableAmount } from "@isl/stdlib/payments/process-refund"
import { CreateSubscription, CancelSubscription, PauseSubscription, ChangePlan, RenewSubscription } from "@isl/stdlib/payments/subscription-create"
import { ReceiveWebhook, ProcessWebhook, HandlePaymentSucceeded, HandlePaymentFailed, HandleSubscriptionEvent } from "@isl/stdlib/payments/webhook-handle"
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"

# ============================================
# Types
# ============================================

type OrderId = UUID { immutable: true, unique: true }

type Money = Decimal { min: 0, precision: 2 }

entity Order {
  id: OrderId [immutable, unique]
  customer_id: UUID [indexed]
  payment_id: UUID?
  status: enum { PENDING, PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED }
  total: Money
  items: List<OrderItem>
  shipping_address: Address
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  lifecycle {
    PENDING -> PAID
    PAID -> SHIPPED
    SHIPPED -> DELIVERED
    PENDING -> CANCELLED
    PAID -> REFUNDED
  }
}

type OrderItem = {
  product_id: UUID
  quantity: Int { min: 1 }
  unit_price: Money
  total: Money
}

type Address = {
  line1: String
  line2: String?
  city: String
  state: String
  postal_code: String
  country: String
}

# ============================================
# Checkout Flows
# ============================================

behavior Checkout {
  description: "Process order checkout"

  actors {
    customer: User { authenticated: true }
  }

  input {
    order_id: OrderId
    payment_method_id: UUID
    idempotency_key: String
  }

  output {
    success: {
      order: Order
      payment_id: UUID
      receipt_url: String?
    }
    errors {
      ORDER_NOT_FOUND
      ORDER_ALREADY_PAID
      PAYMENT_FAILED { retriable: true }
      CARD_DECLINED
      INSUFFICIENT_FUNDS
    }
  }

  pre {
    Order.exists(order_id)
    Order.lookup(order_id).status == PENDING
    Order.lookup(order_id).customer_id == customer.id
  }

  flow {
    # Step 1: Create payment intent
    step 1: CreatePayment(
      customer_id: customer.id,
      amount: order.total,
      currency: USD,
      method: CARD,
      description: "Order #" + order_id,
      idempotency_key: input.idempotency_key,
      metadata: { "order_id": order_id }
    )

    # Step 2: Process payment
    step 2: ProcessPaymentIntent(
      payment_id: payment.id,
      card_id: input.payment_method_id
    )

    # Step 3: Update order
    step 3: update_order_status(order_id, PAID, payment.id)
  }

  post success {
    Order.lookup(order_id).status == PAID
    Order.lookup(order_id).payment_id == result.payment_id
  }

  post PAYMENT_FAILED {
    Order.lookup(order_id).status == PENDING  # Still pending
  }

  temporal {
    within 10s (p99): response returned
    eventually within 5m: confirmation email sent
  }
}

behavior CancelOrder {
  description: "Cancel a pending order"

  actors {
    customer: User { authenticated: true }
  }

  input {
    order_id: OrderId
    reason: String?
  }

  output {
    success: Order
    errors {
      ORDER_NOT_FOUND
      CANNOT_CANCEL { when: "Order already processed" }
    }
  }

  pre {
    Order.exists(order_id)
    Order.lookup(order_id).customer_id == customer.id
    Order.lookup(order_id).status == PENDING
  }

  flow {
    step 1 when order.payment_id != null: CancelPayment(
      payment_id: order.payment_id,
      reason: input.reason
    )
    
    step 2: update_order_status(order_id, CANCELLED)
  }

  post success {
    Order.lookup(order_id).status == CANCELLED
  }
}

# ============================================
# Refund Flows
# ============================================

behavior RequestRefund {
  description: "Request a refund for an order"

  actors {
    customer: User { authenticated: true }
  }

  input {
    order_id: OrderId
    amount: Money?  # null = full refund
    reason: String
  }

  output {
    success: {
      refund_id: UUID
      amount: Money
      status: String
    }
    errors {
      ORDER_NOT_FOUND
      NOT_REFUNDABLE
      AMOUNT_EXCEEDS_AVAILABLE
      REFUND_WINDOW_EXPIRED
    }
  }

  pre {
    Order.exists(order_id)
    Order.lookup(order_id).customer_id == customer.id
    Order.lookup(order_id).status == PAID
    Order.lookup(order_id).payment_id != null
  }

  flow {
    # Step 1: Check refundable amount
    step 1: CalculateRefundableAmount(payment_id: order.payment_id)

    # Step 2: Create refund
    step 2: CreateRefund(
      payment_id: order.payment_id,
      amount: input.amount or refundable.refundable_amount,
      reason: CUSTOMER_REQUEST,
      reason_details: input.reason
    )

    # Step 3: Process refund
    step 3: ProcessRefundIntent(refund_id: refund.id)

    # Step 4: Update order status
    step 4: update_order_status(order_id, REFUNDED)
  }

  post success {
    Order.lookup(order_id).status == REFUNDED
  }

  temporal {
    within 15s (p99): response returned
    eventually within 10d: funds returned to customer
  }
}

behavior AdminRefund {
  description: "Admin-initiated refund"

  actors {
    admin: Admin { role: SUPPORT }
  }

  input {
    order_id: OrderId
    amount: Money?
    reason: enum { CUSTOMER_REQUEST, PRODUCT_ISSUE, SERVICE_ISSUE, DUPLICATE, FRAUDULENT }
    notes: String
  }

  output {
    success: { refund_id: UUID, amount: Money }
    errors { ORDER_NOT_FOUND, NOT_REFUNDABLE, AMOUNT_EXCEEDS_AVAILABLE }
  }

  flow {
    step 1: CreateRefund(
      payment_id: order.payment_id,
      amount: input.amount,
      reason: input.reason,
      reason_details: input.notes
    )

    step 2: ProcessRefundIntent(refund_id: refund.id)
  }

  security {
    audit_log required
    requires_permission "refunds:process"
  }
}

# ============================================
# Subscription Flows
# ============================================

behavior SubscribeToPlan {
  description: "Subscribe customer to a plan"

  actors {
    customer: User { authenticated: true }
  }

  input {
    plan_id: UUID
    payment_method_id: UUID
  }

  output {
    success: {
      subscription_id: UUID
      current_period_end: Timestamp
    }
    errors {
      PLAN_NOT_FOUND
      ALREADY_SUBSCRIBED
      PAYMENT_METHOD_REQUIRED
      PAYMENT_FAILED
    }
  }

  flow {
    step 1: CreateSubscription(
      customer_id: customer.id,
      plan_id: input.plan_id,
      payment_method_id: input.payment_method_id
    )
  }

  temporal {
    within 5s (p99): response returned
    eventually within 5m: welcome email sent
  }
}

behavior ChangePlanFlow {
  description: "Upgrade or downgrade subscription"

  actors {
    customer: User { authenticated: true }
  }

  input {
    subscription_id: UUID
    new_plan_id: UUID
  }

  output {
    success: {
      subscription_id: UUID
      proration_amount: Money?
      next_billing_date: Timestamp
    }
    errors {
      SUBSCRIPTION_NOT_FOUND
      PLAN_NOT_FOUND
      SAME_PLAN
      DOWNGRADE_NOT_ALLOWED
    }
  }

  flow {
    step 1: ChangePlan(
      subscription_id: input.subscription_id,
      new_plan_id: input.new_plan_id,
      prorate: true
    )
  }
}

behavior PauseSubscriptionFlow {
  description: "Temporarily pause subscription"

  actors {
    customer: User { authenticated: true }
  }

  input {
    subscription_id: UUID
    pause_until: Timestamp?
    reason: String?
  }

  output {
    success: { resumed_at: Timestamp? }
    errors { SUBSCRIPTION_NOT_FOUND, INVALID_STATE, PAUSE_LIMIT_EXCEEDED }
  }

  pre {
    input.pause_until == null or input.pause_until <= now() + 90d
  }

  flow {
    step 1: PauseSubscription(
      subscription_id: input.subscription_id,
      pause_until: input.pause_until,
      reason: input.reason
    )
  }
}

# ============================================
# Webhook Handlers
# ============================================

behavior StripeWebhookHandler {
  description: "Handle Stripe webhooks"

  input {
    payload: String
    signature: String
    headers: Map<String, String>
  }

  output {
    success: { processed: Boolean }
    errors { INVALID_SIGNATURE, DUPLICATE_EVENT, PROCESSING_FAILED }
  }

  flow {
    # Step 1: Validate webhook
    step 1: ReceiveWebhook(
      provider: STRIPE,
      payload: input.payload,
      signature: input.signature,
      headers: input.headers
    )

    # Step 2: Route based on event type
    step 2: route_webhook_event(event)
  }
}

behavior HandlePaymentWebhook {
  description: "Process payment webhooks"

  input {
    webhook_id: UUID
    event_type: enum { PAYMENT_SUCCEEDED, PAYMENT_FAILED }
    payment_processor_id: String
    amount: Money?
    failure_code: String?
    failure_message: String?
  }

  flow {
    step when event_type == PAYMENT_SUCCEEDED: HandlePaymentSucceeded(
      webhook_id: input.webhook_id,
      payment_processor_id: input.payment_processor_id,
      amount: input.amount,
      currency: "USD"
    )

    step when event_type == PAYMENT_FAILED: HandlePaymentFailed(
      webhook_id: input.webhook_id,
      payment_processor_id: input.payment_processor_id,
      failure_code: input.failure_code,
      failure_message: input.failure_message
    )
  }

  temporal {
    within 5s (p99): response returned
  }
}

behavior HandleSubscriptionWebhook {
  description: "Process subscription webhooks"

  input {
    webhook_id: UUID
    event_type: enum { SUBSCRIPTION_RENEWED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_PAST_DUE }
    subscription_processor_id: String
    event_data: Map<String, String>
  }

  flow {
    step 1: HandleSubscriptionEvent(
      webhook_id: input.webhook_id,
      subscription_processor_id: input.subscription_processor_id,
      event_type: input.event_type,
      event_data: input.event_data
    )

    step 2 when event_type == SUBSCRIPTION_PAST_DUE: notify_customer_past_due(subscription_id)
  }
}
