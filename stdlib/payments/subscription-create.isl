# Subscription Create Module
# Provides subscription management behaviors

module SubscriptionCreate version "1.0.0"

# ============================================
# Types
# ============================================

type SubscriptionId = UUID { immutable: true, unique: true }

type Money = Decimal { min: 0, precision: 2 }

type Currency = enum { USD, EUR, GBP, CAD, AUD, JPY }

type BillingInterval = enum { DAY, WEEK, MONTH, YEAR }

type SubscriptionStatus = enum {
  ACTIVE
  PAUSED
  PAST_DUE
  CANCELLED
  EXPIRED
  TRIALING
}

# ============================================
# Entities
# ============================================

entity Plan {
  id: UUID [immutable, unique]
  name: String { max_length: 100 }
  description: String?
  amount: Money
  currency: Currency
  interval: BillingInterval
  interval_count: Int { min: 1, max: 365 } [default: 1]
  trial_days: Int { min: 0 } [default: 0]
  is_active: Boolean [default: true]
  created_at: Timestamp [immutable]

  invariants {
    amount >= 0
    interval_count > 0
    trial_days >= 0
  }
}

entity Subscription {
  id: SubscriptionId [immutable, unique]
  customer_id: UUID [indexed]
  plan_id: UUID [indexed]
  status: SubscriptionStatus [indexed]
  current_period_start: Timestamp
  current_period_end: Timestamp
  trial_start: Timestamp?
  trial_end: Timestamp?
  cancelled_at: Timestamp?
  cancel_at_period_end: Boolean [default: false]
  pause_start: Timestamp?
  pause_end: Timestamp?
  payment_method_id: UUID?
  metadata: Map<String, String>?
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    current_period_end > current_period_start
    trial_end != null implies trial_end > trial_start
    status == TRIALING implies trial_end > now()
    status == PAUSED implies pause_start != null
  }

  lifecycle {
    TRIALING -> ACTIVE
    TRIALING -> CANCELLED
    ACTIVE -> PAUSED
    ACTIVE -> PAST_DUE
    ACTIVE -> CANCELLED
    ACTIVE -> EXPIRED
    PAUSED -> ACTIVE
    PAUSED -> CANCELLED
    PAST_DUE -> ACTIVE
    PAST_DUE -> CANCELLED
  }
}

entity SubscriptionInvoice {
  id: UUID [immutable, unique]
  subscription_id: SubscriptionId [indexed]
  payment_id: UUID?
  amount: Money
  currency: Currency
  period_start: Timestamp
  period_end: Timestamp
  status: enum { DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE }
  due_date: Timestamp
  paid_at: Timestamp?
  created_at: Timestamp [immutable]
}

# ============================================
# Behaviors
# ============================================

behavior CreateSubscription {
  description: "Create a new subscription for a customer"

  input {
    customer_id: UUID
    plan_id: UUID
    payment_method_id: UUID?
    start_date: Timestamp? [default: now()]
    trial_days: Int? # Override plan default
    metadata: Map<String, String>?
  }

  output {
    success: Subscription

    errors {
      CUSTOMER_NOT_FOUND {
        when: "Customer does not exist"
        retriable: false
      }
      PLAN_NOT_FOUND {
        when: "Plan does not exist"
        retriable: false
      }
      PLAN_INACTIVE {
        when: "Plan is not active"
        retriable: false
      }
      PAYMENT_METHOD_REQUIRED {
        when: "No payment method provided and no trial"
        retriable: true
      }
      ALREADY_SUBSCRIBED {
        when: "Customer already has active subscription to this plan"
        retriable: false
      }
    }
  }

  pre {
    Customer.exists(customer_id)
    Plan.exists(plan_id)
    Plan.lookup(plan_id).is_active
  }

  post success {
    Subscription.exists(result.id)
    result.customer_id == input.customer_id
    result.plan_id == input.plan_id
    result.status in [ACTIVE, TRIALING]
    input.trial_days > 0 or Plan.trial_days > 0 implies result.status == TRIALING
  }

  temporal {
    within 1s (p99): response returned
    eventually within 5m: welcome email sent
  }
}

behavior CancelSubscription {
  description: "Cancel a subscription"

  input {
    subscription_id: SubscriptionId
    cancel_immediately: Boolean [default: false]
    reason: String?
  }

  output {
    success: Subscription

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
      ALREADY_CANCELLED {
        when: "Subscription already cancelled"
        retriable: false
      }
    }
  }

  pre {
    Subscription.exists(subscription_id)
    Subscription.lookup(subscription_id).status not in [CANCELLED, EXPIRED]
  }

  post success when input.cancel_immediately {
    result.status == CANCELLED
    result.cancelled_at == now()
  }

  post success when not input.cancel_immediately {
    result.cancel_at_period_end == true
    result.status == old(status)  # Still active until period end
  }

  temporal {
    within 500ms (p99): response returned
    eventually within 5m: cancellation notification sent
  }
}

behavior PauseSubscription {
  description: "Pause a subscription temporarily"

  input {
    subscription_id: SubscriptionId
    pause_until: Timestamp?  # null = indefinite
    reason: String?
  }

  output {
    success: Subscription

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
      INVALID_STATE {
        when: "Subscription cannot be paused"
        retriable: false
      }
      PAUSE_LIMIT_EXCEEDED {
        when: "Maximum pause duration exceeded"
        retriable: false
      }
    }
  }

  pre {
    Subscription.exists(subscription_id)
    Subscription.lookup(subscription_id).status == ACTIVE
    input.pause_until == null or input.pause_until > now()
  }

  post success {
    result.status == PAUSED
    result.pause_start == now()
    result.pause_end == input.pause_until
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior ResumeSubscription {
  description: "Resume a paused subscription"

  input {
    subscription_id: SubscriptionId
  }

  output {
    success: Subscription

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
      NOT_PAUSED {
        when: "Subscription is not paused"
        retriable: false
      }
    }
  }

  pre {
    Subscription.exists(subscription_id)
    Subscription.lookup(subscription_id).status == PAUSED
  }

  post success {
    result.status == ACTIVE
    result.pause_start == null
    result.pause_end == null
  }

  temporal {
    within 500ms (p99): response returned
  }
}

behavior ChangePlan {
  description: "Change subscription to a different plan"

  input {
    subscription_id: SubscriptionId
    new_plan_id: UUID
    prorate: Boolean [default: true]
  }

  output {
    success: {
      subscription: Subscription
      proration_amount: Money?
    }

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
      PLAN_NOT_FOUND {
        when: "New plan does not exist"
        retriable: false
      }
      SAME_PLAN {
        when: "Already subscribed to this plan"
        retriable: false
      }
      DOWNGRADE_NOT_ALLOWED {
        when: "Downgrade not allowed for this plan"
        retriable: false
      }
    }
  }

  pre {
    Subscription.exists(subscription_id)
    Plan.exists(new_plan_id)
    Plan.lookup(new_plan_id).is_active
    new_plan_id != Subscription.lookup(subscription_id).plan_id
  }

  post success {
    result.subscription.plan_id == input.new_plan_id
  }

  temporal {
    within 1s (p99): response returned
  }
}

behavior GetSubscription {
  description: "Retrieve subscription details"

  input {
    subscription_id: SubscriptionId
  }

  output {
    success: {
      subscription: Subscription
      plan: Plan
      next_invoice_date: Timestamp?
      next_invoice_amount: Money?
    }

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
    }
  }

  post success {
    result.subscription.id == input.subscription_id
    result.plan.id == result.subscription.plan_id
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior RenewSubscription {
  description: "Process subscription renewal"

  input {
    subscription_id: SubscriptionId
  }

  output {
    success: {
      subscription: Subscription
      invoice: SubscriptionInvoice
      payment: Payment?
    }

    errors {
      SUBSCRIPTION_NOT_FOUND {
        when: "Subscription does not exist"
        retriable: false
      }
      PAYMENT_FAILED {
        when: "Renewal payment failed"
        retriable: true
        retry_after: 24h
      }
      NO_PAYMENT_METHOD {
        when: "No payment method on file"
        retriable: false
      }
    }
  }

  pre {
    Subscription.exists(subscription_id)
    Subscription.lookup(subscription_id).status == ACTIVE
    Subscription.lookup(subscription_id).current_period_end <= now()
  }

  post success {
    result.subscription.current_period_start == old(current_period_end)
    result.subscription.current_period_end > now()
    result.invoice.status == PAID
  }

  post PAYMENT_FAILED {
    Subscription.lookup(subscription_id).status == PAST_DUE
  }

  temporal {
    within 10s (p99): response returned
    eventually within 5m: renewal notification sent
  }
}
