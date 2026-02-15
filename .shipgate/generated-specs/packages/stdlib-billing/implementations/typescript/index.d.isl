# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CustomerId, SubscriptionId, InvoiceId, PlanId, PriceId, PaymentMethodId, CouponId, Currency, Plan, Subscription, CancellationDetails, PauseCollection, Invoice, LineItem, PaymentMethod, CardDetails, BankAccountDetails, BillingDetails, Address, UsageRecord, UsageSummary, BillingProvider, CreateSubscriptionInput, CreateSubscriptionResult, CancelSubscriptionInput, CancelSubscriptionResult, ChangePlanInput, ChangePlanResult, RecordUsageInput, CreateInvoiceInput, PayInvoiceInput, PayInvoiceResult, BillingProviderInterface, WebhookEvent, BillingServiceConfig
# dependencies: 

domain IndexD {
  version: "1.0.0"

  type CustomerId = String
  type SubscriptionId = String
  type InvoiceId = String
  type PlanId = String
  type PriceId = String
  type PaymentMethodId = String
  type CouponId = String
  type Currency = String
  type Plan = String
  type Subscription = String
  type CancellationDetails = String
  type PauseCollection = String
  type Invoice = String
  type LineItem = String
  type PaymentMethod = String
  type CardDetails = String
  type BankAccountDetails = String
  type BillingDetails = String
  type Address = String
  type UsageRecord = String
  type UsageSummary = String
  type BillingProvider = String
  type CreateSubscriptionInput = String
  type CreateSubscriptionResult = String
  type CancelSubscriptionInput = String
  type CancelSubscriptionResult = String
  type ChangePlanInput = String
  type ChangePlanResult = String
  type RecordUsageInput = String
  type CreateInvoiceInput = String
  type PayInvoiceInput = String
  type PayInvoiceResult = String
  type BillingProviderInterface = String
  type WebhookEvent = String
  type BillingServiceConfig = String

  invariants exports_present {
    - true
  }
}
