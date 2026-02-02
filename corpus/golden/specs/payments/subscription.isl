// Payments: Subscription management
domain PaymentsSubscription {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum BillingInterval {
    DAILY
    WEEKLY
    MONTHLY
    YEARLY
  }

  enum SubscriptionStatus {
    ACTIVE
    PAST_DUE
    CANCELLED
    PAUSED
    TRIALING
    INCOMPLETE
  }

  entity Plan {
    id: UUID [immutable, unique]
    name: String
    description: String?
    amount: Decimal
    currency: String
    interval: BillingInterval
    trial_days: Int?
    active: Boolean
    features: List<String>
    created_at: Timestamp [immutable]

    invariants {
      amount >= 0
      trial_days == null or trial_days >= 0
    }
  }

  entity Subscription {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    plan_id: UUID [indexed]
    status: SubscriptionStatus
    current_period_start: Timestamp
    current_period_end: Timestamp
    trial_start: Timestamp?
    trial_end: Timestamp?
    cancelled_at: Timestamp?
    cancel_at_period_end: Boolean [default: false]
    payment_method_id: UUID?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      current_period_end > current_period_start
      trial_end == null or trial_end >= trial_start
    }

    lifecycle {
      INCOMPLETE -> TRIALING
      INCOMPLETE -> ACTIVE
      TRIALING -> ACTIVE
      ACTIVE -> PAST_DUE
      PAST_DUE -> ACTIVE
      ACTIVE -> PAUSED
      PAUSED -> ACTIVE
      ACTIVE -> CANCELLED
      PAST_DUE -> CANCELLED
      PAUSED -> CANCELLED
    }
  }

  behavior CreateSubscription {
    description: "Create a new subscription"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      customer_id: UUID
      plan_id: UUID
      payment_method_id: UUID?
      trial_from_plan: Boolean?
      metadata: Map<String, String>?
    }

    output {
      success: Subscription

      errors {
        PLAN_NOT_FOUND {
          when: "Plan does not exist"
          retriable: false
        }
        PLAN_INACTIVE {
          when: "Plan is not active"
          retriable: false
        }
        CUSTOMER_NOT_FOUND {
          when: "Customer does not exist"
          retriable: false
        }
        PAYMENT_METHOD_REQUIRED {
          when: "Payment method required"
          retriable: true
        }
        ALREADY_SUBSCRIBED {
          when: "Already subscribed to this plan"
          retriable: false
        }
      }
    }

    pre {
      Plan.exists(input.plan_id)
      Plan.lookup(input.plan_id).active == true
    }

    post success {
      - Subscription.exists(result.id)
      - result.customer_id == input.customer_id
      - result.plan_id == input.plan_id
      - result.status == ACTIVE or result.status == TRIALING or result.status == INCOMPLETE
    }

    temporal {
      - within 2s (p99): response returned
    }
  }

  behavior CancelSubscription {
    description: "Cancel a subscription"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      subscription_id: UUID
      cancel_immediately: Boolean?
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
          when: "Subscription is already cancelled"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status != CANCELLED
    }

    post success {
      - input.cancel_immediately == true implies result.status == CANCELLED
      - input.cancel_immediately != true implies result.cancel_at_period_end == true
    }
  }

  behavior UpdateSubscription {
    description: "Update subscription plan"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      subscription_id: UUID
      plan_id: UUID?
      payment_method_id: UUID?
      proration_behavior: String?
    }

    output {
      success: Subscription

      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
          retriable: false
        }
        PLAN_NOT_FOUND {
          when: "Plan does not exist"
          retriable: false
        }
        DOWNGRADE_NOT_ALLOWED {
          when: "Plan downgrade not allowed"
          retriable: false
        }
      }
    }

    pre {
      Subscription.exists(input.subscription_id)
      input.plan_id == null or Plan.exists(input.plan_id)
    }

    post success {
      - input.plan_id != null implies result.plan_id == input.plan_id
    }
  }

  behavior PauseSubscription {
    description: "Pause a subscription"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      subscription_id: UUID
      resume_at: Timestamp?
    }

    output {
      success: Subscription

      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
          retriable: false
        }
        NOT_PAUSABLE {
          when: "Subscription cannot be paused"
          retriable: false
        }
      }
    }

    pre {
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status == ACTIVE
    }

    post success {
      - result.status == PAUSED
    }
  }

  behavior ResumeSubscription {
    description: "Resume a paused subscription"

    actors {
      Customer { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      subscription_id: UUID
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
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status == PAUSED
    }

    post success {
      - result.status == ACTIVE
    }
  }

  scenarios CreateSubscription {
    scenario "create with trial" {
      given {
        plan = Plan.create(amount: 9.99, trial_days: 14, active: true)
      }

      when {
        result = CreateSubscription(
          customer_id: "cust-123",
          plan_id: plan.id,
          trial_from_plan: true
        )
      }

      then {
        result is success
        result.status == TRIALING
        result.trial_end != null
      }
    }

    scenario "create without trial" {
      given {
        plan = Plan.create(amount: 9.99, active: true)
      }

      when {
        result = CreateSubscription(
          customer_id: "cust-123",
          plan_id: plan.id,
          payment_method_id: "pm-123"
        )
      }

      then {
        result is success
        result.status == ACTIVE
      }
    }
  }
}
