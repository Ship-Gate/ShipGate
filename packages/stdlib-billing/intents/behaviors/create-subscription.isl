// ============================================================================
// Create Subscription Behavior
// ============================================================================

behavior CreateSubscription {
  description: "Create a new subscription for a customer"
  
  actors {
    customer: Customer
    admin: Admin
    service: Internal
  }
  
  input {
    customer_id: CustomerId
    plan_id: PlanId
    price_id: PriceId?
    
    // Payment
    payment_method_id: PaymentMethodId?
    default_payment_method: PaymentMethodId?
    
    // Quantity
    quantity: Int { min: 1 }?
    
    // Trial
    trial_days: Int { min: 0, max: 365 }?
    trial_end: Timestamp?  // Explicit trial end
    trial_from_plan: Boolean?  // Use plan's trial
    
    // Discounts
    coupon_code: String?
    promotion_code: String?
    
    // Billing
    billing_cycle_anchor: Timestamp?
    collection_method: CollectionMethod?
    days_until_due: Int { min: 1, max: 90 }?
    
    // Proration
    proration_behavior: ProrationBehavior?
    
    // Dates
    cancel_at: Timestamp?
    cancel_at_period_end: Boolean?
    
    // Add-ons
    add_ons: List<AddOnItem>?
    
    // Metadata
    metadata: Map<String, String>?
    
    // Idempotency
    idempotency_key: String?
  }
  
  output {
    success: CreateSubscriptionResult
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
        when: "No payment method on file and no trial"
        retriable: false
      }
      PAYMENT_METHOD_INVALID {
        when: "Payment method cannot be charged"
        retriable: false
      }
      PAYMENT_FAILED { 
        when: "Initial payment failed"
        retriable: true
        retry_after: 5.seconds
      }
      ALREADY_SUBSCRIBED { 
        when: "Customer already has active subscription to this plan"
        retriable: false
      }
      INVALID_COUPON { 
        when: "Coupon code is invalid or expired"
        retriable: false
      }
      COUPON_NOT_APPLICABLE {
        when: "Coupon cannot be applied to this plan"
        retriable: false
      }
      TRIAL_NOT_ALLOWED {
        when: "Trial not allowed for this plan"
        retriable: false
      }
      INVALID_QUANTITY {
        when: "Quantity exceeds plan limits"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Plan must exist and be active
    Plan.exists(input.plan_id)
    Plan.lookup(input.plan_id).active == true
    
    // Customer must exist
    Customer.exists(input.customer_id)
    
    // No duplicate active subscription
    not Subscription.exists(
      customer_id: input.customer_id,
      plan_id: input.plan_id,
      status in [ACTIVE, TRIALING, PAST_DUE]
    )
    
    // Coupon must be valid if provided
    input.coupon_code != null implies Coupon.exists(input.coupon_code) and Coupon.lookup(input.coupon_code).valid
    
    // Trial end must be in the future
    input.trial_end != null implies input.trial_end > now()
    
    // Cancel at must be in the future
    input.cancel_at != null implies input.cancel_at > now()
  }
  
  postconditions {
    success implies {
      // Subscription created
      Subscription.exists(result.subscription.id)
      
      // Correct customer and plan
      result.subscription.customer_id == input.customer_id
      result.subscription.plan_id == input.plan_id
      
      // Status is either trialing or active
      result.subscription.status in [TRIALING, ACTIVE, INCOMPLETE]
      
      // If trial specified, status is TRIALING
      (input.trial_days > 0 or input.trial_end != null) implies {
        result.subscription.status == TRIALING
        result.subscription.trial_end != null
      }
      
      // Quantity is set correctly
      result.subscription.quantity == (input.quantity ?? 1)
      
      // Discount applied if coupon provided
      input.coupon_code != null implies result.subscription.discount != null
    }
    
    PAYMENT_FAILED implies {
      // Subscription may be created in incomplete state
      result.subscription == null or result.subscription.status == INCOMPLETE
    }
  }
  
  temporal {
    response within 2.seconds (p99)
  }
  
  security {
    requires authentication
    
    // Customers can only create subscriptions for themselves
    actor is Customer implies input.customer_id == actor.id
    
    // Admins can create for any customer
    actor is Admin implies allow
  }
  
  observability {
    metrics {
      subscriptions_created: counter { 
        labels: [plan_id, has_trial, has_coupon, status] 
      }
      subscription_creation_duration: histogram {
        labels: [plan_id]
        buckets: [0.1, 0.25, 0.5, 1, 2, 5]
      }
      subscription_mrr: gauge {
        labels: [plan_id, currency]
      }
    }
    
    traces {
      span "create_subscription" {
        attributes: [customer_id, plan_id]
      }
    }
    
    logs {
      success: info { 
        include: [subscription_id, customer_id, plan_id, status, trial_end]
        exclude: [payment_method_id]
      }
      error: warn {
        include: [customer_id, plan_id, error_code, error_message]
      }
    }
  }
}

// Result type
type CreateSubscriptionResult = {
  subscription: Subscription
  latest_invoice: Invoice?
  pending_setup_intent: String?
}

type AddOnItem = {
  price_id: PriceId
  quantity: Int { min: 1 }
}

// ============================================================================
// Update Subscription Behavior
// ============================================================================

behavior UpdateSubscription {
  description: "Update an existing subscription"
  
  input {
    subscription_id: SubscriptionId
    
    // Updates
    quantity: Int { min: 1 }?
    metadata: Map<String, String>?
    default_payment_method: PaymentMethodId?
    collection_method: CollectionMethod?
    days_until_due: Int?
    
    // Proration
    proration_behavior: ProrationBehavior?
    
    // Billing
    billing_cycle_anchor: BillingAnchorAction?
    
    // Trial
    trial_end: Timestamp | "now"?
  }
  
  output {
    success: Subscription
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      INVALID_STATUS { when: "Subscription cannot be modified in current status" }
      PAYMENT_METHOD_INVALID { }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Subscription.lookup(input.subscription_id).status in [ACTIVE, TRIALING, PAST_DUE]
  }
  
  postconditions {
    success implies {
      input.quantity != null implies result.quantity == input.quantity
      input.default_payment_method != null implies {
        result.default_payment_method_id == input.default_payment_method
      }
    }
  }
}

enum BillingAnchorAction {
  NOW
  UNCHANGED
}
