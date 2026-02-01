// ============================================================================
// Change Plan Behavior
// ============================================================================

behavior ChangePlan {
  description: "Upgrade or downgrade subscription plan"
  
  actors {
    customer: Customer
    admin: Admin
  }
  
  input {
    subscription_id: SubscriptionId
    new_plan_id: PlanId
    new_price_id: PriceId?
    
    // Quantity (if changing)
    quantity: Int { min: 1 }?
    
    // Proration
    proration_behavior: ProrationBehavior?
    proration_date: Timestamp?  // Custom proration calculation date
    
    // Billing
    billing_cycle_anchor: BillingAnchorAction?
    
    // Payment
    payment_behavior: PaymentBehavior?
    
    // Trial (for downgrades to plans with trial)
    trial_from_plan: Boolean?
  }
  
  output {
    success: ChangePlanResult
    errors {
      SUBSCRIPTION_NOT_FOUND {
        retriable: false
      }
      PLAN_NOT_FOUND {
        retriable: false
      }
      PLAN_INACTIVE {
        when: "New plan is not active"
        retriable: false
      }
      SAME_PLAN { 
        when: "Already on this plan"
        retriable: false
      }
      CANNOT_CHANGE {
        when: "Subscription cannot be modified in current state"
        retriable: false
      }
      PAYMENT_FAILED { 
        when: "Payment for upgrade failed"
        retriable: true
        retry_after: 5.seconds
      }
      DOWNGRADE_NOT_ALLOWED {
        when: "Downgrading to this plan is not permitted"
        retriable: false
      }
      CURRENCY_MISMATCH {
        when: "New plan currency doesn't match subscription"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Subscription must exist
    Subscription.exists(input.subscription_id)
    
    // Subscription must be modifiable
    Subscription.lookup(input.subscription_id).status in [ACTIVE, TRIALING]
    Subscription.lookup(input.subscription_id).cancel_at_period_end == false
    
    // New plan must exist and be active
    Plan.exists(input.new_plan_id)
    Plan.lookup(input.new_plan_id).active == true
    
    // Cannot change to same plan (unless changing quantity)
    Subscription.lookup(input.subscription_id).plan_id != input.new_plan_id or
      input.quantity != Subscription.lookup(input.subscription_id).quantity
    
    // Currency must match
    Plan.lookup(input.new_plan_id).currency == 
      Plan.lookup(Subscription.lookup(input.subscription_id).plan_id).currency
  }
  
  postconditions {
    success implies {
      // Plan is updated
      Subscription.lookup(input.subscription_id).plan_id == input.new_plan_id
      
      // Quantity is updated if specified
      input.quantity != null implies {
        Subscription.lookup(input.subscription_id).quantity == input.quantity
      }
      
      // Prorations created if applicable
      input.proration_behavior != NONE implies {
        result.prorations != null and result.prorations.length > 0
      }
      
      // Invoice created for immediate payment if upgrade
      (is_upgrade and input.payment_behavior == INVOICE_IMMEDIATELY) implies {
        result.invoice != null
      }
    }
  }
  
  temporal {
    response within 3.seconds (p99)
  }
  
  security {
    requires authentication
    
    actor is Customer implies {
      Subscription.lookup(input.subscription_id).customer_id == actor.id
    }
  }
  
  observability {
    metrics {
      plan_changes: counter {
        labels: [from_plan, to_plan, direction, proration_behavior]
      }
      plan_change_value: histogram {
        labels: [direction]  // upgrade/downgrade
      }
    }
    
    logs {
      success: info {
        include: [subscription_id, from_plan, to_plan, proration_amount]
      }
    }
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

enum PaymentBehavior {
  ALLOW_INCOMPLETE         // Allow subscription with unpaid invoice
  DEFAULT_INCOMPLETE       // Default behavior
  ERROR_IF_INCOMPLETE      // Error if payment fails
  PENDING_IF_INCOMPLETE    // Mark as pending
}

// Result with proration details
type ChangePlanResult = {
  subscription: Subscription
  prorations: List<LineItem>?
  invoice: Invoice?
  credit_applied: Money?
  amount_due: Money?
}

// ============================================================================
// Preview Plan Change Behavior
// ============================================================================

behavior PreviewPlanChange {
  description: "Preview the cost of changing plans without executing"
  
  input {
    subscription_id: SubscriptionId
    new_plan_id: PlanId
    quantity: Int { min: 1 }?
    proration_behavior: ProrationBehavior?
    proration_date: Timestamp?
  }
  
  output {
    success: PlanChangePreview
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      PLAN_NOT_FOUND { }
      CANNOT_PREVIEW { when: "Cannot preview in current subscription state" }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Plan.exists(input.new_plan_id)
  }
  
  // This is a read-only operation - no postconditions that modify state
  postconditions {
    // Preview does not modify subscription
    Subscription.lookup(input.subscription_id) == old(Subscription.lookup(input.subscription_id))
  }
  
  temporal {
    response within 500.ms (p99)
  }
}

type PlanChangePreview = {
  current_plan: PlanSummary
  new_plan: PlanSummary
  
  // Cost breakdown
  proration_credit: Money    // Credit for unused time on current plan
  proration_charge: Money    // Charge for remaining time on new plan
  net_amount: Money          // proration_charge - proration_credit
  
  // If upgrade, amount due immediately
  immediate_charge: Money?
  
  // New recurring amount
  new_recurring_amount: Money
  
  // Next invoice preview
  next_invoice_amount: Money
  next_invoice_date: Timestamp
  
  // Line items preview
  line_items: List<LineItem>
  
  // Direction
  is_upgrade: Boolean
  is_downgrade: Boolean
}

type PlanSummary = {
  id: PlanId
  name: String
  amount: Money
  currency: Currency
  interval: BillingInterval
}

// ============================================================================
// Schedule Plan Change Behavior
// ============================================================================

behavior SchedulePlanChange {
  description: "Schedule a plan change for a future date"
  
  input {
    subscription_id: SubscriptionId
    new_plan_id: PlanId
    effective_date: Timestamp  // When to apply the change
    quantity: Int { min: 1 }?
  }
  
  output {
    success: ScheduledPlanChange
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      PLAN_NOT_FOUND { }
      INVALID_DATE { when: "Effective date must be in the future" }
      ALREADY_SCHEDULED { when: "A plan change is already scheduled" }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Plan.exists(input.new_plan_id)
    input.effective_date > now()
  }
  
  postconditions {
    success implies {
      result.scheduled_for == input.effective_date
      result.new_plan_id == input.new_plan_id
    }
  }
  
  temporal {
    // Change should be applied at scheduled time
    eventually within (input.effective_date - now() + 1.hour): {
      Subscription.lookup(input.subscription_id).plan_id == input.new_plan_id
    }
  }
}

type ScheduledPlanChange = {
  id: String
  subscription_id: SubscriptionId
  current_plan_id: PlanId
  new_plan_id: PlanId
  scheduled_for: Timestamp
  status: ScheduledChangeStatus
}

enum ScheduledChangeStatus {
  PENDING
  APPLIED
  CANCELED
}
