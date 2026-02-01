# Stripe Subscriptions Domain
# Complete subscription management with Stripe integration

domain StripeSubscriptions {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type StripeCustomerId = String { prefix: "cus_" }
  type StripeSubscriptionId = String { prefix: "sub_" }
  type StripePriceId = String { prefix: "price_" }
  type StripeProductId = String { prefix: "prod_" }
  type StripePaymentMethodId = String { prefix: "pm_" }
  type StripeInvoiceId = String { prefix: "in_" }
  
  type Money = Decimal { min: 0, precision: 2 }
  
  enum Currency {
    USD
    EUR
    GBP
    CAD
    AUD
  }
  
  enum BillingInterval {
    DAY
    WEEK
    MONTH
    YEAR
  }
  
  enum SubscriptionStatus {
    TRIALING
    ACTIVE
    PAST_DUE
    CANCELED
    UNPAID
    INCOMPLETE
    INCOMPLETE_EXPIRED
    PAUSED
  }
  
  enum InvoiceStatus {
    DRAFT
    OPEN
    PAID
    VOID
    UNCOLLECTIBLE
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Customer {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    stripe_customer_id: StripeCustomerId [unique, indexed]
    email: String { format: "email" }
    name: String?
    default_payment_method_id: StripePaymentMethodId?
    balance: Money [default: 0]
    currency: Currency?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity Plan {
    id: UUID [immutable, unique]
    stripe_product_id: StripeProductId [unique, indexed]
    stripe_price_id: StripePriceId [unique, indexed]
    name: String { max_length: 255 }
    description: String?
    amount: Money
    currency: Currency
    interval: BillingInterval
    interval_count: Int [default: 1]
    trial_days: Int?
    features: List<String>
    is_active: Boolean [default: true]
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      amount >= 0
      interval_count > 0
      trial_days == null or trial_days >= 0
    }
  }
  
  entity Subscription {
    id: UUID [immutable, unique]
    stripe_subscription_id: StripeSubscriptionId [unique, indexed]
    customer_id: UUID [indexed]
    plan_id: UUID [indexed]
    status: SubscriptionStatus
    current_period_start: Timestamp
    current_period_end: Timestamp
    trial_start: Timestamp?
    trial_end: Timestamp?
    cancel_at_period_end: Boolean [default: false]
    canceled_at: Timestamp?
    ended_at: Timestamp?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      current_period_end > current_period_start
      trial_end == null or trial_end >= trial_start
      canceled_at != null implies status in [CANCELED]
    }
    
    lifecycle {
      INCOMPLETE -> ACTIVE
      INCOMPLETE -> INCOMPLETE_EXPIRED
      TRIALING -> ACTIVE
      TRIALING -> CANCELED
      ACTIVE -> PAST_DUE
      ACTIVE -> CANCELED
      ACTIVE -> PAUSED
      PAST_DUE -> ACTIVE
      PAST_DUE -> CANCELED
      PAST_DUE -> UNPAID
      PAUSED -> ACTIVE
      PAUSED -> CANCELED
    }
  }
  
  entity Invoice {
    id: UUID [immutable, unique]
    stripe_invoice_id: StripeInvoiceId [unique, indexed]
    customer_id: UUID [indexed]
    subscription_id: UUID? [indexed]
    status: InvoiceStatus
    amount_due: Money
    amount_paid: Money
    amount_remaining: Money
    currency: Currency
    period_start: Timestamp
    period_end: Timestamp
    due_date: Timestamp?
    paid_at: Timestamp?
    invoice_pdf: String?
    hosted_invoice_url: String?
    created_at: Timestamp [immutable]
    
    invariants {
      amount_due >= 0
      amount_paid >= 0
      amount_remaining >= 0
      amount_remaining == amount_due - amount_paid
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateCustomer {
    description: "Create a Stripe customer for a user"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      user_id: UUID
      email: String
      name: String?
      payment_method_id: StripePaymentMethodId?
      metadata: Map<String, String>?
    }
    
    output {
      success: Customer
      
      errors {
        USER_ALREADY_HAS_CUSTOMER {
          when: "User already has a Stripe customer"
          retriable: false
        }
        STRIPE_ERROR {
          when: "Stripe API error"
          retriable: true
          retry_after: 5s
        }
        INVALID_PAYMENT_METHOD {
          when: "Payment method is invalid"
          retriable: false
        }
      }
    }
    
    preconditions {
      not Customer.exists(user_id: input.user_id)
    }
    
    postconditions {
      success implies {
        Customer.exists(user_id: input.user_id)
        Customer.lookup_by_user(input.user_id).stripe_customer_id != null
      }
    }
    
    effects {
      Stripe { create_customer }
    }
  }
  
  behavior CreateSubscription {
    description: "Subscribe a customer to a plan"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      customer_id: UUID
      plan_id: UUID
      payment_method_id: StripePaymentMethodId?
      trial_days: Int?
      coupon_code: String?
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
        ALREADY_SUBSCRIBED {
          when: "Customer already has an active subscription to this plan"
          retriable: false
        }
        PAYMENT_FAILED {
          when: "Payment method declined"
          retriable: true
        }
        INVALID_COUPON {
          when: "Coupon code is invalid or expired"
          retriable: false
        }
        STRIPE_ERROR {
          when: "Stripe API error"
          retriable: true
          retry_after: 5s
        }
      }
    }
    
    preconditions {
      Customer.exists(input.customer_id)
      Plan.exists(input.plan_id)
      Plan.lookup(input.plan_id).is_active
    }
    
    postconditions {
      success implies {
        Subscription.exists(
          customer_id: input.customer_id,
          plan_id: input.plan_id
        )
        Subscription.lookup(result.id).status in [TRIALING, ACTIVE, INCOMPLETE]
      }
    }
    
    temporal {
      response within 10s
      eventually within 1m: webhook_received
    }
    
    effects {
      Stripe { create_subscription }
      Email { send_welcome }
    }
  }
  
  behavior CancelSubscription {
    description: "Cancel a subscription"
    
    actors {
      User { must: authenticated, owns: subscription }
      Admin { must: authenticated }
    }
    
    input {
      subscription_id: UUID
      cancel_immediately: Boolean [default: false]
      cancellation_reason: String?
      feedback: String?
    }
    
    output {
      success: Subscription
      
      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription does not exist"
          retriable: false
        }
        ALREADY_CANCELED {
          when: "Subscription is already canceled"
          retriable: false
        }
        CANNOT_CANCEL {
          when: "Subscription cannot be canceled in current state"
          retriable: false
        }
      }
    }
    
    preconditions {
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status not in [CANCELED, INCOMPLETE_EXPIRED]
    }
    
    postconditions {
      success implies {
        input.cancel_immediately implies Subscription.lookup(input.subscription_id).status == CANCELED
        not input.cancel_immediately implies Subscription.lookup(input.subscription_id).cancel_at_period_end == true
      }
    }
    
    effects {
      Stripe { cancel_subscription }
      Email { send_cancellation_confirmation }
      Analytics { track_churn }
    }
  }
  
  behavior ChangePlan {
    description: "Change subscription to a different plan"
    
    actors {
      User { must: authenticated, owns: subscription }
      Admin { must: authenticated }
    }
    
    input {
      subscription_id: UUID
      new_plan_id: UUID
      prorate: Boolean [default: true]
    }
    
    output {
      success: Subscription
      
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
        PAYMENT_FAILED {
          when: "Payment for upgrade failed"
          retriable: true
        }
        DOWNGRADE_NOT_ALLOWED {
          when: "Downgrade not allowed for this subscription"
          retriable: false
        }
      }
    }
    
    preconditions {
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status == ACTIVE
      Plan.exists(input.new_plan_id)
      Plan.lookup(input.new_plan_id).is_active
      Subscription.lookup(input.subscription_id).plan_id != input.new_plan_id
    }
    
    postconditions {
      success implies {
        Subscription.lookup(input.subscription_id).plan_id == input.new_plan_id
      }
    }
  }
  
  behavior ResumeSubscription {
    description: "Resume a paused or canceled subscription"
    
    actors {
      User { must: authenticated, owns: subscription }
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
        CANNOT_RESUME {
          when: "Subscription cannot be resumed"
          retriable: false
        }
        PAYMENT_FAILED {
          when: "Payment method declined"
          retriable: true
        }
      }
    }
    
    preconditions {
      Subscription.exists(input.subscription_id)
      Subscription.lookup(input.subscription_id).status in [PAUSED] or
      Subscription.lookup(input.subscription_id).cancel_at_period_end == true
    }
    
    postconditions {
      success implies {
        Subscription.lookup(input.subscription_id).status == ACTIVE
        Subscription.lookup(input.subscription_id).cancel_at_period_end == false
      }
    }
  }
  
  behavior GetUpcomingInvoice {
    description: "Preview the next invoice for a subscription"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      subscription_id: UUID
      new_plan_id: UUID?
    }
    
    output {
      success: {
        amount_due: Money
        currency: Currency
        period_start: Timestamp
        period_end: Timestamp
        line_items: List<{
          description: String
          amount: Money
          quantity: Int
        }>
        proration_amount: Money?
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CreateSubscription {
    scenario "new subscription with trial" {
      given {
        customer = Customer.create(user_id: user.id)
        plan = Plan.create(
          name: "Pro",
          amount: 29.99,
          interval: MONTH,
          trial_days: 14
        )
      }
      
      when {
        result = CreateSubscription(
          customer_id: customer.id,
          plan_id: plan.id
        )
      }
      
      then {
        result is success
        result.status == TRIALING
        result.trial_end > now()
      }
    }
    
    scenario "upgrade subscription" {
      given {
        subscription = Subscription.create(
          customer_id: customer.id,
          plan_id: basic_plan.id,
          status: ACTIVE
        )
        pro_plan = Plan.create(
          name: "Pro",
          amount: 49.99,
          interval: MONTH
        )
      }
      
      when {
        result = ChangePlan(
          subscription_id: subscription.id,
          new_plan_id: pro_plan.id,
          prorate: true
        )
      }
      
      then {
        result is success
        result.plan_id == pro_plan.id
      }
    }
  }
}
