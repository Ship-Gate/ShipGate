# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PaymentId, RefundId, IdempotencyKey, PaymentMethodToken, Money, Currency, CardPaymentMethod, BankAccountPaymentMethod, WalletPaymentMethod, PaymentMethod, Payment, Refund, WebhookEvent, PCIMetadata, FraudSignals, IdempotencyRecord, Result, PaymentError, RefundError
# dependencies: 

domain Types {
  version: "1.0.0"

  type PaymentId = String
  type RefundId = String
  type IdempotencyKey = String
  type PaymentMethodToken = String
  type Money = String
  type Currency = String
  type CardPaymentMethod = String
  type BankAccountPaymentMethod = String
  type WalletPaymentMethod = String
  type PaymentMethod = String
  type Payment = String
  type Refund = String
  type WebhookEvent = String
  type PCIMetadata = String
  type FraudSignals = String
  type IdempotencyRecord = String
  type Result = String
  type PaymentError = String
  type RefundError = String

  invariants exports_present {
    - true
  }
}
