// ============================================================================
// Billing Domain - Subscription & Payment Management Standard Library
// Version: 1.0.0
// ============================================================================

domain Billing {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // Import behaviors
  import { CreateSubscription, UpdateSubscription } from "./behaviors/create-subscription.isl"
  import { CancelSubscription, PauseSubscription, ResumeSubscription } from "./behaviors/cancel-subscription.isl"
  import { ChangePlan, PreviewPlanChange } from "./behaviors/change-plan.isl"
  import { CreateInvoice, PayInvoice, VoidInvoice } from "./behaviors/process-invoice.isl"
  import { RecordUsage, GetUsageSummary } from "./behaviors/usage-record.isl"
  
  // Import entities
  import { Subscription } from "./subscription.isl"
  import { Invoice, LineItem } from "./invoice.isl"
  import { PaymentMethod } from "./payment-method.isl"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type CustomerId = String { 
    max_length: 64 
    pattern: /^[a-zA-Z0-9_-]+$/
  }
  
  type SubscriptionId = UUID
  type InvoiceId = UUID
  type PaymentMethodId = String { max_length: 64 }
  type PlanId = String { 
    pattern: /^[a-z][a-z0-9_-]*$/ 
    max_length: 64
  }
  type PriceId = String { max_length: 64 }
  type CouponId = String { max_length: 64 }
  type DiscountId = String { max_length: 64 }
  
  // Money type with currency
  type Money = Decimal { 
    min: 0
    precision: 2
  }
  
  type Currency = String {
    pattern: /^[A-Z]{3}$/  // ISO 4217
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum SubscriptionStatus {
    TRIALING       // In trial period
    ACTIVE         // Active and billing
    PAST_DUE       // Payment failed, grace period
    CANCELED       // Subscription ended
    UNPAID         // Multiple payment failures
    PAUSED         // Temporarily paused
    INCOMPLETE     // Initial payment pending
  }
  
  enum BillingInterval {
    DAY
    WEEK
    MONTH
    YEAR
    CUSTOM
  }
  
  enum InvoiceStatus {
    DRAFT          // Being prepared
    OPEN           // Awaiting payment
    PAID           // Successfully paid
    VOID           // Voided/canceled
    UNCOLLECTIBLE  // Cannot collect
  }
  
  enum PaymentMethodType {
    CARD
    BANK_ACCOUNT
    SEPA_DEBIT
    PAYPAL
    APPLE_PAY
    GOOGLE_PAY
  }
  
  enum ProrationBehavior {
    CREATE_PRORATIONS    // Create prorated line items
    NONE                 // No proration
    ALWAYS_INVOICE       // Always create invoice immediately
  }
  
  enum CollectionMethod {
    CHARGE_AUTOMATICALLY
    SEND_INVOICE
  }
  
  enum UsageAction {
    INCREMENT   // Add to existing usage
    SET         // Set absolute value
  }
  
  // ============================================================================
  // PLAN ENTITY
  // ============================================================================
  
  entity Plan {
    id: PlanId [unique, indexed]
    name: String { max_length: 255 }
    description: String?
    
    // Pricing
    amount: Money
    currency: Currency
    interval: BillingInterval
    interval_count: Int { min: 1, max: 365 }
    
    // Trial
    trial_days: Int { min: 0, max: 365 }?
    
    // Features & limits
    features: List<String>
    usage_type: UsageType?
    
    // Metadata
    metadata: Map<String, String>?
    active: Boolean
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      amount >= 0
      interval_count >= 1
      trial_days == null or trial_days >= 0
    }
  }
  
  enum UsageType {
    LICENSED    // Fixed quantity
    METERED     // Usage-based billing
    TIERED      // Tiered pricing
  }
  
  // ============================================================================
  // CUSTOMER ENTITY (Reference)
  // ============================================================================
  
  entity Customer {
    id: CustomerId [unique, indexed]
    email: String { format: email }
    name: String?
    
    // Billing info
    default_payment_method_id: PaymentMethodId?
    currency: Currency?
    balance: Money  // Account credit/debit
    
    // Tax
    tax_exempt: Boolean
    tax_ids: List<TaxId>?
    
    // Address
    billing_address: Address?
    
    metadata: Map<String, String>?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      balance can be negative  // Credit balance
    }
  }
  
  type Address = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String { pattern: /^[A-Z]{2}$/ }  // ISO 3166-1 alpha-2
  }
  
  type TaxId = {
    type: String   // e.g., "eu_vat", "us_ein"
    value: String
    verified: Boolean
  }
  
  // ============================================================================
  // DISCOUNT/COUPON
  // ============================================================================
  
  entity Coupon {
    id: CouponId [unique]
    name: String?
    
    // Discount type
    percent_off: Decimal { min: 0, max: 100 }?
    amount_off: Money?
    currency: Currency?  // Required if amount_off
    
    // Validity
    duration: CouponDuration
    duration_in_months: Int { min: 1 }?  // For REPEATING
    max_redemptions: Int { min: 1 }?
    times_redeemed: Int { min: 0 }
    
    // Restrictions
    applies_to_plans: List<PlanId>?
    
    valid: Boolean
    redeem_by: Timestamp?
    
    created_at: Timestamp [immutable]
    
    invariants {
      // Must have either percent_off or amount_off, not both
      (percent_off != null) xor (amount_off != null)
      amount_off != null implies currency != null
      duration == REPEATING implies duration_in_months != null
    }
  }
  
  enum CouponDuration {
    FOREVER
    ONCE
    REPEATING
  }
  
  // ============================================================================
  // WEBHOOK EVENTS
  // ============================================================================
  
  type WebhookEvent = {
    id: String [unique]
    type: WebhookEventType
    data: Map<String, Any>
    created_at: Timestamp
    livemode: Boolean
  }
  
  enum WebhookEventType {
    // Subscription events
    SUBSCRIPTION_CREATED
    SUBSCRIPTION_UPDATED
    SUBSCRIPTION_DELETED
    SUBSCRIPTION_TRIAL_WILL_END
    
    // Invoice events
    INVOICE_CREATED
    INVOICE_FINALIZED
    INVOICE_PAID
    INVOICE_PAYMENT_FAILED
    INVOICE_UPCOMING
    
    // Payment events
    PAYMENT_METHOD_ATTACHED
    PAYMENT_METHOD_DETACHED
    PAYMENT_INTENT_SUCCEEDED
    PAYMENT_INTENT_FAILED
    
    // Customer events
    CUSTOMER_CREATED
    CUSTOMER_UPDATED
    CUSTOMER_DELETED
  }
  
  // ============================================================================
  // RESULT TYPES
  // ============================================================================
  
  type ChangePlanResult = {
    subscription: Subscription
    prorations: List<LineItem>?
    invoice: Invoice?
  }
  
  type UsageRecord = {
    id: String
    subscription_id: SubscriptionId
    quantity: Int
    timestamp: Timestamp
    action: UsageAction
  }
  
  type UsageSummary = {
    subscription_id: SubscriptionId
    total_usage: Int
    period_start: Timestamp
    period_end: Timestamp
    records: List<UsageRecord>
  }
  
  // ============================================================================
  // GLOBAL INVARIANTS
  // ============================================================================
  
  invariants BillingConsistency {
    description: "Billing data must be consistent"
    scope: global
    
    always {
      // Active subscriptions must have valid payment method or be in trial
      all(Subscription, s =>
        s.status == ACTIVE implies (
          s.customer.default_payment_method_id != null or
          s.trial_end > now()
        )
      )
      
      // Invoice amounts must balance
      all(Invoice, i =>
        i.amount_remaining == i.amount_due - i.amount_paid
      )
    }
  }
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  policy SubscriptionAccess {
    applies_to: [CancelSubscription, ChangePlan, PauseSubscription]
    
    rules {
      // Customer can only modify own subscriptions
      actor is Customer implies {
        target.subscription.customer_id == actor.id
      }
      
      // Admins can modify any subscription
      actor is Admin implies allow
    }
  }
  
  policy PaymentRetry {
    applies_to: [ProcessPayment]
    
    rules {
      // Retry failed payments up to 3 times
      retry_count <= 3 implies allow_retry
      retry_count > 3 implies mark_uncollectible
      
      // Exponential backoff
      retry_delay = 2^retry_count hours
    }
  }
}
