// ============================================================================
// ISL Payments Domain - Standard Library
// Version: 1.0.0
// PCI DSS Compliant Payment Processing
// ============================================================================

domain Payments {
  version: "1.0.0"
  owner: "stdlib-payments@intentos.dev"
  
  imports {
    Money from "@stdlib/finance"
  }
  
  // ==========================================================================
  // CORE TYPES
  // ==========================================================================
  
  type PaymentId = UUID {
    immutable: true
  }
  
  type IdempotencyKey = String {
    min_length: 1
    max_length: 255
    pattern: /^[a-zA-Z0-9_-]+$/
  }
  
  type Amount = Decimal {
    precision: 2
    min: 0.01
    max: 999999999.99
  }
  
  type Currency = String {
    length: 3
    pattern: /^[A-Z]{3}$/
  }
  
  type Email = String {
    format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    max_length: 254
  }
  
  // ==========================================================================
  // PAYMENT METHOD TYPES (PCI COMPLIANT - NO RAW CARD DATA)
  // ==========================================================================
  
  type PaymentMethodToken = String {
    pattern: /^pm_[a-zA-Z0-9]{24,}$/
    description: "Tokenized payment method reference - never stores raw card data"
  }
  
  type CardBrand = enum {
    VISA
    MASTERCARD
    AMEX
    DISCOVER
    DINERS
    JCB
    UNIONPAY
    UNKNOWN
  }
  
  type PaymentMethodInfo =
    | Card { 
        token: PaymentMethodToken,
        brand: CardBrand, 
        last_four: String { length: 4, pattern: /^[0-9]{4}$/ },
        exp_month: Int { min: 1, max: 12 },
        exp_year: Int { min: 2024, max: 2099 },
        fingerprint: String [pci_sensitive]
      }
    | BankAccount { 
        token: PaymentMethodToken,
        bank_name: String,
        routing_last_four: String { length: 4 },
        account_last_four: String { length: 4 },
        account_type: BankAccountType
      }
    | Wallet { 
        token: PaymentMethodToken,
        provider: WalletProvider, 
        wallet_id: String 
      }
  
  type BankAccountType = enum {
    CHECKING
    SAVINGS
  }
  
  type WalletProvider = enum {
    APPLE_PAY
    GOOGLE_PAY
    PAYPAL
    STRIPE_LINK
  }
  
  // ==========================================================================
  // PAYMENT STATUS LIFECYCLE
  // ==========================================================================
  
  enum PaymentStatus {
    PENDING           // Initial state, awaiting processing
    REQUIRES_ACTION   // 3DS or additional authentication needed
    PROCESSING        // Being processed by payment provider
    AUTHORIZED        // Funds held, not yet captured
    CAPTURED          // Funds transferred
    PARTIALLY_REFUNDED
    REFUNDED          // Fully reversed
    FAILED            // Processing failed
    CANCELED          // Canceled before completion
    DISPUTED          // Chargeback initiated
  }
  
  enum RefundStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
  }
  
  // ==========================================================================
  // ERROR TYPES
  // ==========================================================================
  
  type PaymentErrorCode = enum {
    CARD_DECLINED
    INSUFFICIENT_FUNDS
    INVALID_CARD
    EXPIRED_CARD
    PROCESSING_ERROR
    AUTHENTICATION_REQUIRED
    FRAUD_DETECTED
    RATE_LIMITED
    DUPLICATE_REQUEST
    INVALID_AMOUNT
    CURRENCY_NOT_SUPPORTED
    PAYMENT_METHOD_NOT_SUPPORTED
    PROVIDER_UNAVAILABLE
    NETWORK_ERROR
    IDEMPOTENCY_CONFLICT
  }
  
  type RefundErrorCode = enum {
    PAYMENT_NOT_FOUND
    PAYMENT_NOT_CAPTURED
    AMOUNT_EXCEEDS_AVAILABLE
    REFUND_ALREADY_PENDING
    REFUND_WINDOW_EXPIRED
    PROVIDER_ERROR
  }
  
  // ==========================================================================
  // WEBHOOK TYPES
  // ==========================================================================
  
  type WebhookEventType = enum {
    PAYMENT_CREATED
    PAYMENT_AUTHORIZED
    PAYMENT_CAPTURED
    PAYMENT_FAILED
    PAYMENT_REFUNDED
    PAYMENT_DISPUTED
    REFUND_CREATED
    REFUND_SUCCEEDED
    REFUND_FAILED
  }
  
  type WebhookProvider = enum {
    STRIPE
    BRAINTREE
    ADYEN
    SQUARE
  }
  
  // ==========================================================================
  // COMPLIANCE METADATA
  // ==========================================================================
  
  type PCIMetadata = {
    tokenization_method: String
    tokenized_at: Timestamp
    provider_reference: String
    compliance_level: Int { min: 1, max: 4 }
  }
  
  type FraudSignals = {
    risk_score: Decimal { min: 0, max: 100 }
    risk_level: RiskLevel
    checks_performed: List<String>
    ip_address: String [pii]
    device_fingerprint: String?
  }
  
  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }
}
