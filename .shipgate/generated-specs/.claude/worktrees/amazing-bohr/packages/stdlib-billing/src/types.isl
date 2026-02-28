# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CustomerId, SubscriptionId, InvoiceId, PlanId, PriceId, PaymentMethodId, CouponId, DiscountId, Currency, BillingProvider, CancellationDetails, PauseCollection, DiscountInfo, Address, CardDetails, BankAccountDetails, BillingDetails, PaymentMethod, WebhookEvent
# dependencies: 

domain Types {
  version: "1.0.0"

  type CustomerId = String
  type SubscriptionId = String
  type InvoiceId = String
  type PlanId = String
  type PriceId = String
  type PaymentMethodId = String
  type CouponId = String
  type DiscountId = String
  type Currency = String
  type BillingProvider = String
  type CancellationDetails = String
  type PauseCollection = String
  type DiscountInfo = String
  type Address = String
  type CardDetails = String
  type BankAccountDetails = String
  type BillingDetails = String
  type PaymentMethod = String
  type WebhookEvent = String

  invariants exports_present {
    - true
  }
}
