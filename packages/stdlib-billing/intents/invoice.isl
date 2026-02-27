// ============================================================================
// Invoice Entity Definition
// ============================================================================

entity Invoice {
  // ============================================================================
  // FIELDS
  // ============================================================================
  
  id: InvoiceId [immutable, unique, indexed]
  number: String? [unique]  // Human-readable invoice number
  
  // Customer
  customer_id: CustomerId [indexed]
  customer_email: String?
  customer_name: String?
  customer_address: Address?
  
  // Subscription reference
  subscription_id: SubscriptionId? [indexed]
  
  // Status
  status: InvoiceStatus [indexed]
  
  // Amounts
  subtotal: Money
  subtotal_excluding_tax: Money?
  tax: Money?
  total: Money
  total_excluding_tax: Money?
  
  amount_due: Money
  amount_paid: Money
  amount_remaining: Money
  
  // Currency
  currency: Currency
  
  // Discount
  discount: DiscountInfo?
  total_discount_amounts: Money?
  
  // Line items
  line_items: List<LineItem>
  
  // Dates
  period_start: Timestamp?
  period_end: Timestamp?
  due_date: Timestamp?
  
  // Payment
  paid: Boolean
  paid_at: Timestamp?
  payment_intent_id: String?
  charge_id: String?
  
  // Collection
  collection_method: CollectionMethod
  auto_advance: Boolean  // Auto-finalize
  next_payment_attempt: Timestamp?
  attempt_count: Int { min: 0 }
  
  // URLs
  hosted_invoice_url: String?
  invoice_pdf: String?
  
  // Billing reason
  billing_reason: BillingReason?
  
  // Metadata
  metadata: Map<String, String>?
  footer: String?
  description: String?
  statement_descriptor: String?
  
  // Provider reference
  provider_invoice_id: String?
  provider: BillingProvider
  
  // Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  finalized_at: Timestamp?
  voided_at: Timestamp?
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants {
    // Amount calculations must balance
    amount_remaining == amount_due - amount_paid
    amount_paid <= amount_due
    amount_paid >= 0
    amount_remaining >= 0
    
    // Paid invoices
    status == PAID implies paid == true
    status == PAID implies paid_at != null
    status == PAID implies amount_remaining == 0
    
    // Total must equal subtotal + tax - discount
    total == subtotal + (tax ?? 0) - (total_discount_amounts ?? 0)
    
    // Voided invoices
    status == VOID implies voided_at != null
    
    // Finalized invoices
    status != DRAFT implies finalized_at != null
  }
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  computed {
    is_paid: Boolean = status == PAID
    
    is_open: Boolean = status == OPEN
    
    is_overdue: Boolean = status == OPEN and due_date != null and due_date < now()
    
    days_overdue: Int = is_overdue ? (now() - due_date).days : 0
    
    is_forgiven: Boolean = status == VOID or status == UNCOLLECTIBLE
    
    effective_tax_rate: Decimal = subtotal > 0 and tax != null
      ? (tax / subtotal) * 100
      : 0
    
    line_item_count: Int = line_items.length
    
    has_discount: Boolean = discount != null or total_discount_amounts > 0
  }
  
  // ============================================================================
  // METHODS
  // ============================================================================
  
  methods {
    can_pay(): Boolean {
      return status == OPEN and amount_remaining > 0
    }
    
    can_void(): Boolean {
      return status in [DRAFT, OPEN]
    }
    
    can_mark_uncollectible(): Boolean {
      return status == OPEN
    }
    
    calculate_late_fee(rate: Decimal): Money {
      if (not is_overdue) return 0
      return amount_remaining * rate * days_overdue / 365
    }
  }
}

// ============================================================================
// LINE ITEM
// ============================================================================

type LineItem = {
  id: String
  description: String
  
  // Pricing
  quantity: Int { min: 0 }
  unit_amount: Money
  unit_amount_excluding_tax: Money?
  amount: Money
  amount_excluding_tax: Money?
  
  // Tax
  tax_amounts: List<TaxAmount>?
  tax_rates: List<String>?
  
  // Period (for subscriptions)
  period_start: Timestamp?
  period_end: Timestamp?
  
  // Proration
  proration: Boolean?
  proration_details: ProrationDetails?
  
  // Discount
  discount_amounts: List<DiscountAmount>?
  discountable: Boolean?
  
  // References
  price_id: PriceId?
  subscription_id: SubscriptionId?
  subscription_item_id: String?
  
  // Metadata
  metadata: Map<String, String>?
}

type TaxAmount = {
  amount: Money
  inclusive: Boolean
  tax_rate_id: String
  taxability_reason: String?
}

type DiscountAmount = {
  amount: Money
  discount_id: DiscountId
}

type ProrationDetails = {
  credited_items: List<{
    invoice_id: InvoiceId
    invoice_line_item_id: String
  }>?
}

enum BillingReason {
  SUBSCRIPTION_CREATE
  SUBSCRIPTION_CYCLE
  SUBSCRIPTION_UPDATE
  SUBSCRIPTION_THRESHOLD
  UPCOMING
  MANUAL
}

// ============================================================================
// INVOICE ITEM (Standalone)
// ============================================================================

entity InvoiceItem {
  id: String [unique]
  customer_id: CustomerId
  invoice_id: InvoiceId?
  subscription_id: SubscriptionId?
  
  description: String
  amount: Money
  currency: Currency
  quantity: Int { min: 1 }
  unit_amount: Money
  
  discountable: Boolean
  proration: Boolean
  
  period_start: Timestamp?
  period_end: Timestamp?
  
  metadata: Map<String, String>?
  
  created_at: Timestamp [immutable]
}
