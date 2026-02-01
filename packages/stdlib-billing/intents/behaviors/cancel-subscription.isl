// ============================================================================
// Cancel Subscription Behavior
// ============================================================================

behavior CancelSubscription {
  description: "Cancel a subscription immediately or at period end"
  
  actors {
    customer: Customer
    admin: Admin
    service: Internal
  }
  
  input {
    subscription_id: SubscriptionId
    
    // Cancellation options
    cancel_immediately: Boolean?  // Default: false (cancel at period end)
    cancel_at: Timestamp?         // Cancel at specific time
    
    // Refund options
    prorate: Boolean?             // Prorate remaining time
    invoice_now: Boolean?         // Invoice immediately for usage
    
    // Feedback
    cancellation_details: CancellationDetailsInput?
    
    // Options
    preserve_payment_method: Boolean?  // Keep payment method attached
  }
  
  output {
    success: CancelSubscriptionResult
    errors {
      SUBSCRIPTION_NOT_FOUND {
        retriable: false
      }
      ALREADY_CANCELED {
        when: "Subscription is already canceled"
        retriable: false
      }
      INVALID_CANCEL_DATE {
        when: "Cancel date is in the past"
        retriable: false
      }
      CANNOT_CANCEL {
        when: "Subscription cannot be canceled in current state"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Subscription must exist
    Subscription.exists(input.subscription_id)
    
    // Not already canceled
    Subscription.lookup(input.subscription_id).status != CANCELED
    
    // Cancel at must be in the future
    input.cancel_at != null implies input.cancel_at > now()
  }
  
  postconditions {
    success implies {
      // Immediate cancellation
      input.cancel_immediately == true implies {
        result.subscription.status == CANCELED
        result.subscription.canceled_at != null
        result.subscription.ended_at != null
      }
      
      // End of period cancellation
      input.cancel_immediately != true and input.cancel_at == null implies {
        result.subscription.cancel_at_period_end == true
        result.subscription.status != CANCELED  // Still active until period end
      }
      
      // Scheduled cancellation
      input.cancel_at != null implies {
        result.subscription.cancel_at == input.cancel_at
      }
      
      // Cancellation details recorded
      input.cancellation_details != null implies {
        result.subscription.cancellation_details != null
      }
    }
  }
  
  temporal {
    response within 1.second (p99)
    
    // Subscription access should end promptly
    input.cancel_immediately implies {
      eventually within 1.minute: subscription_access_revoked
    }
  }
  
  security {
    requires authentication
    
    // Customers can only cancel own subscriptions
    actor is Customer implies {
      Subscription.lookup(input.subscription_id).customer_id == actor.id
    }
  }
  
  observability {
    metrics {
      subscriptions_canceled: counter {
        labels: [plan_id, reason, immediate]
      }
      subscription_lifetime_days: histogram {
        labels: [plan_id]
      }
      churn_rate: gauge {
        labels: [plan_id, period]
      }
    }
    
    logs {
      success: info {
        include: [subscription_id, customer_id, plan_id, reason, immediate]
      }
    }
  }
}

type CancellationDetailsInput = {
  reason: CancellationReason?
  feedback: String { max_length: 1000 }?
  comment: String { max_length: 500 }?
}

type CancelSubscriptionResult = {
  subscription: Subscription
  prorated_credit: Money?
  final_invoice: Invoice?
}

// ============================================================================
// Pause Subscription Behavior
// ============================================================================

behavior PauseSubscription {
  description: "Temporarily pause a subscription"
  
  actors {
    customer: Customer
    admin: Admin
  }
  
  input {
    subscription_id: SubscriptionId
    
    // Pause options
    pause_behavior: PauseBehavior?
    resumes_at: Timestamp?  // Auto-resume date
    
    // Reason
    reason: String?
  }
  
  output {
    success: Subscription
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      ALREADY_PAUSED { when: "Subscription is already paused" }
      CANNOT_PAUSE { when: "Subscription cannot be paused in current state" }
      PAUSE_NOT_ALLOWED { when: "Plan does not allow pausing" }
      INVALID_RESUME_DATE { when: "Resume date is in the past" }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Subscription.lookup(input.subscription_id).status == ACTIVE
    Subscription.lookup(input.subscription_id).pause_collection == null
    input.resumes_at != null implies input.resumes_at > now()
  }
  
  postconditions {
    success implies {
      result.status == PAUSED or result.pause_collection != null
      input.resumes_at != null implies result.pause_collection.resumes_at == input.resumes_at
    }
  }
  
  temporal {
    // If resumes_at is set, subscription should auto-resume
    input.resumes_at != null implies {
      eventually within (input.resumes_at - now() + 1.hour): {
        Subscription.lookup(input.subscription_id).status == ACTIVE
      }
    }
  }
}

// ============================================================================
// Resume Subscription Behavior
// ============================================================================

behavior ResumeSubscription {
  description: "Resume a paused subscription"
  
  actors {
    customer: Customer
    admin: Admin
    service: Internal  // For auto-resume
  }
  
  input {
    subscription_id: SubscriptionId
    
    // Billing options
    billing_cycle_anchor: BillingAnchorAction?
    proration_behavior: ProrationBehavior?
  }
  
  output {
    success: ResumeSubscriptionResult
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      NOT_PAUSED { when: "Subscription is not paused" }
      PAYMENT_METHOD_REQUIRED { when: "No payment method to resume billing" }
      PAYMENT_FAILED { retriable: true }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Subscription.lookup(input.subscription_id).status == PAUSED or
    Subscription.lookup(input.subscription_id).pause_collection != null
  }
  
  postconditions {
    success implies {
      result.subscription.status == ACTIVE
      result.subscription.pause_collection == null
    }
  }
}

type ResumeSubscriptionResult = {
  subscription: Subscription
  invoice: Invoice?  // If billing resumed with invoice
}

// ============================================================================
// Reactivate Subscription Behavior
// ============================================================================

behavior ReactivateSubscription {
  description: "Reactivate a canceled subscription (within grace period)"
  
  input {
    subscription_id: SubscriptionId
    payment_method_id: PaymentMethodId?
  }
  
  output {
    success: Subscription
    errors {
      SUBSCRIPTION_NOT_FOUND { }
      NOT_CANCELED { when: "Subscription is not canceled" }
      GRACE_PERIOD_EXPIRED { when: "Reactivation window has passed" }
      PAYMENT_FAILED { retriable: true }
    }
  }
  
  preconditions {
    Subscription.exists(input.subscription_id)
    Subscription.lookup(input.subscription_id).status == CANCELED
    // Within reactivation window (e.g., subscription ended less than 30 days ago)
    Subscription.lookup(input.subscription_id).ended_at + 30.days > now()
  }
  
  postconditions {
    success implies {
      result.status == ACTIVE
      result.canceled_at == null
      result.cancel_at_period_end == false
    }
  }
}
