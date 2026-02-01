// ============================================================================
// Subscription Entity Definition
// ============================================================================

entity Subscription {
  // ============================================================================
  // FIELDS
  // ============================================================================
  
  id: SubscriptionId [immutable, unique, indexed]
  
  // Customer & Plan
  customer_id: CustomerId [immutable, indexed]
  plan_id: PlanId [indexed]
  price_id: PriceId?
  
  // Status
  status: SubscriptionStatus [indexed]
  
  // Billing periods
  current_period_start: Timestamp
  current_period_end: Timestamp
  billing_cycle_anchor: Timestamp
  
  // Trial
  trial_start: Timestamp?
  trial_end: Timestamp?
  
  // Cancellation
  canceled_at: Timestamp?
  cancel_at: Timestamp?
  cancel_at_period_end: Boolean
  cancellation_details: CancellationDetails?
  
  // Quantity & pricing
  quantity: Int { min: 1 }
  
  // Discounts
  discount_id: DiscountId?
  discount: DiscountInfo?
  
  // Collection
  collection_method: CollectionMethod
  days_until_due: Int { min: 0 }?
  
  // Payment
  default_payment_method_id: PaymentMethodId?
  latest_invoice_id: InvoiceId?
  pending_setup_intent_id: String?
  
  // Pause
  pause_collection: PauseCollection?
  
  // Metadata
  metadata: Map<String, String>?
  
  // Provider reference
  provider_subscription_id: String?  // External ID (Stripe, Paddle)
  provider: BillingProvider
  
  // Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  ended_at: Timestamp?
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants {
    // Trial dates must be consistent
    trial_end != null implies trial_start != null
    trial_start != null implies trial_start <= trial_end
    
    // Canceled subscriptions must have timestamp
    status == CANCELED implies canceled_at != null
    
    // Period must be valid
    current_period_end > current_period_start
    
    // Quantity must be positive
    quantity >= 1
    
    // Cancel at must be in the future or null
    cancel_at != null implies cancel_at > now()
    
    // Ended subscriptions have ended_at
    status == CANCELED implies ended_at != null or cancel_at_period_end
  }
  
  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  
  lifecycle {
    // Initial states
    INCOMPLETE -> ACTIVE: when payment_succeeded
    INCOMPLETE -> INCOMPLETE_EXPIRED: when payment_deadline_passed
    
    // Trial flow
    TRIALING -> ACTIVE: when trial_ended and payment_succeeded
    TRIALING -> PAST_DUE: when trial_ended and payment_failed
    TRIALING -> CANCELED: when canceled_during_trial
    
    // Active subscription
    ACTIVE -> PAST_DUE: when payment_failed
    ACTIVE -> CANCELED: when canceled_immediately
    ACTIVE -> PAUSED: when paused
    
    // Recovery from past due
    PAST_DUE -> ACTIVE: when payment_succeeded
    PAST_DUE -> CANCELED: when max_retries_exceeded
    PAST_DUE -> UNPAID: when grace_period_ended
    
    // Unpaid final state
    UNPAID -> CANCELED: when canceled or after_unpaid_period
    
    // Pause/resume
    PAUSED -> ACTIVE: when resumed
    PAUSED -> CANCELED: when canceled_while_paused
  }
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  computed {
    is_active: Boolean = status in [ACTIVE, TRIALING, PAST_DUE]
    
    is_trialing: Boolean = status == TRIALING and trial_end > now()
    
    will_cancel: Boolean = cancel_at_period_end or cancel_at != null
    
    days_until_renewal: Int = (current_period_end - now()).days
    
    days_in_trial: Int = trial_start != null and trial_end != null
      ? (trial_end - trial_start).days
      : 0
    
    trial_remaining_days: Int = is_trialing
      ? max(0, (trial_end - now()).days)
      : 0
    
    is_paused: Boolean = status == PAUSED or pause_collection != null
    
    effective_end_date: Timestamp = cancel_at ?? current_period_end
  }
  
  // ============================================================================
  // METHODS
  // ============================================================================
  
  methods {
    can_change_plan(): Boolean {
      return status in [ACTIVE, TRIALING] and not will_cancel
    }
    
    can_pause(): Boolean {
      return status == ACTIVE and pause_collection == null
    }
    
    can_resume(): Boolean {
      return status == PAUSED or pause_collection != null
    }
    
    can_cancel(): Boolean {
      return status != CANCELED
    }
    
    calculate_proration(new_plan: Plan, behavior: ProrationBehavior): Money {
      if (behavior == NONE) return 0
      
      remaining_days = (current_period_end - now()).days
      total_days = (current_period_end - current_period_start).days
      
      current_daily_rate = Plan.lookup(plan_id).amount / total_days
      new_daily_rate = new_plan.amount / total_days
      
      credit = current_daily_rate * remaining_days
      charge = new_daily_rate * remaining_days
      
      return charge - credit
    }
  }
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

type CancellationDetails = {
  reason: CancellationReason?
  feedback: String?
  comment: String?
}

enum CancellationReason {
  CUSTOMER_REQUEST
  PAYMENT_FAILURE
  FRAUD
  DUPLICATE
  PRODUCT_UNSATISFACTORY
  TOO_EXPENSIVE
  MISSING_FEATURES
  SWITCHED_SERVICE
  UNUSED
  OTHER
}

type PauseCollection = {
  behavior: PauseBehavior
  resumes_at: Timestamp?
}

enum PauseBehavior {
  KEEP_AS_DRAFT      // Invoices created as drafts
  MARK_UNCOLLECTIBLE // Invoices marked uncollectible
  VOID               // Invoices voided
}

type DiscountInfo = {
  coupon_id: CouponId
  percent_off: Decimal?
  amount_off: Money?
  start: Timestamp
  end: Timestamp?
}

enum BillingProvider {
  STRIPE
  PADDLE
  INTERNAL
}
