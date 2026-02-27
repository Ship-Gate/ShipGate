// ============================================================================
// Payment Method Entity Definition
// ============================================================================

entity PaymentMethod {
  // ============================================================================
  // FIELDS
  // ============================================================================
  
  id: PaymentMethodId [unique, indexed]
  
  // Customer
  customer_id: CustomerId? [indexed]
  
  // Type
  type: PaymentMethodType
  
  // Status
  status: PaymentMethodStatus
  
  // Card details (if type == CARD)
  card: CardDetails?
  
  // Bank account details (if type == BANK_ACCOUNT)
  bank_account: BankAccountDetails?
  
  // SEPA details (if type == SEPA_DEBIT)
  sepa_debit: SepaDebitDetails?
  
  // Billing details
  billing_details: BillingDetails?
  
  // Metadata
  metadata: Map<String, String>?
  
  // Provider reference
  provider_payment_method_id: String?
  provider: BillingProvider
  
  // Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants {
    // Card details required for CARD type
    type == CARD implies card != null
    
    // Bank account details required for BANK_ACCOUNT type
    type == BANK_ACCOUNT implies bank_account != null
    
    // SEPA details required for SEPA_DEBIT type
    type == SEPA_DEBIT implies sepa_debit != null
    
    // Card must not be expired
    type == CARD and card != null implies not card.is_expired
  }
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  computed {
    is_reusable: Boolean = status == ACTIVE and customer_id != null
    
    is_expired: Boolean = type == CARD and card != null and card.is_expired
    
    display_brand: String = type == CARD and card != null
      ? card.brand
      : type.name
    
    last_four: String? = type == CARD and card != null
      ? card.last4
      : type == BANK_ACCOUNT and bank_account != null
        ? bank_account.last4
        : null
    
    expiry_display: String? = type == CARD and card != null
      ? "${card.exp_month}/${card.exp_year}"
      : null
  }
  
  // ============================================================================
  // METHODS
  // ============================================================================
  
  methods {
    can_charge(): Boolean {
      return status == ACTIVE and not is_expired
    }
    
    supports_currency(currency: Currency): Boolean {
      // Cards generally support most currencies
      if (type == CARD) return true
      
      // Bank accounts are currency-specific
      if (type == BANK_ACCOUNT and bank_account != null) {
        return bank_account.currency == currency
      }
      
      // SEPA only supports EUR
      if (type == SEPA_DEBIT) return currency == "EUR"
      
      return false
    }
  }
}

// ============================================================================
// PAYMENT METHOD STATUS
// ============================================================================

enum PaymentMethodStatus {
  ACTIVE           // Ready to use
  PENDING          // Verification pending
  FAILED           // Verification failed
  CANCELED         // Removed by customer
  EXPIRED          // Card expired
}

// ============================================================================
// CARD DETAILS
// ============================================================================

type CardDetails = {
  brand: CardBrand
  last4: String { length: 4 }
  exp_month: Int { min: 1, max: 12 }
  exp_year: Int { min: 2020 }
  
  // Additional info
  funding: CardFunding?
  country: String { pattern: /^[A-Z]{2}$/ }?
  
  // 3D Secure
  three_d_secure_usage: ThreeDSecureUsage?
  
  // Network tokens
  networks: CardNetworks?
  
  // Fingerprint for duplicate detection
  fingerprint: String?
  
  // Computed
  is_expired: Boolean = (exp_year < now().year) or 
    (exp_year == now().year and exp_month < now().month)
}

enum CardBrand {
  VISA
  MASTERCARD
  AMEX
  DISCOVER
  DINERS
  JCB
  UNIONPAY
  UNKNOWN
}

enum CardFunding {
  CREDIT
  DEBIT
  PREPAID
  UNKNOWN
}

type ThreeDSecureUsage = {
  supported: Boolean
}

type CardNetworks = {
  available: List<String>
  preferred: String?
}

// ============================================================================
// BANK ACCOUNT DETAILS
// ============================================================================

type BankAccountDetails = {
  bank_name: String?
  last4: String { length: 4 }
  routing_number: String?
  account_holder_type: AccountHolderType?
  account_type: BankAccountType?
  currency: Currency
  country: String { pattern: /^[A-Z]{2}$/ }
  fingerprint: String?
  status: BankAccountStatus
}

enum AccountHolderType {
  INDIVIDUAL
  COMPANY
}

enum BankAccountType {
  CHECKING
  SAVINGS
}

enum BankAccountStatus {
  NEW
  VALIDATED
  VERIFIED
  VERIFICATION_FAILED
  ERRORED
}

// ============================================================================
// SEPA DEBIT DETAILS
// ============================================================================

type SepaDebitDetails = {
  bank_code: String?
  branch_code: String?
  country: String { pattern: /^[A-Z]{2}$/ }
  fingerprint: String?
  last4: String { length: 4 }
  mandate_reference: String?
  mandate_url: String?
}

// ============================================================================
// BILLING DETAILS
// ============================================================================

type BillingDetails = {
  name: String?
  email: String { format: email }?
  phone: String?
  address: Address?
}

// ============================================================================
// PAYMENT INTENT
// ============================================================================

entity PaymentIntent {
  id: String [unique]
  
  amount: Money
  currency: Currency
  status: PaymentIntentStatus
  
  customer_id: CustomerId?
  payment_method_id: PaymentMethodId?
  invoice_id: InvoiceId?
  
  // Capture
  capture_method: CaptureMethod
  captured_amount: Money?
  
  // Confirmation
  confirmation_method: ConfirmationMethod
  
  // Client secret for frontend
  client_secret: String
  
  // Error info
  last_payment_error: PaymentError?
  
  // Cancellation
  canceled_at: Timestamp?
  cancellation_reason: PaymentCancellationReason?
  
  // Metadata
  metadata: Map<String, String>?
  description: String?
  statement_descriptor: String?
  
  created_at: Timestamp [immutable]
  
  invariants {
    amount > 0
    captured_amount == null or captured_amount <= amount
  }
}

enum PaymentIntentStatus {
  REQUIRES_PAYMENT_METHOD
  REQUIRES_CONFIRMATION
  REQUIRES_ACTION
  PROCESSING
  REQUIRES_CAPTURE
  CANCELED
  SUCCEEDED
}

enum CaptureMethod {
  AUTOMATIC
  MANUAL
}

enum ConfirmationMethod {
  AUTOMATIC
  MANUAL
}

enum PaymentCancellationReason {
  DUPLICATE
  FRAUDULENT
  REQUESTED_BY_CUSTOMER
  ABANDONED
  FAILED_INVOICE
}

type PaymentError = {
  code: String
  message: String
  decline_code: String?
  payment_method_id: PaymentMethodId?
}
