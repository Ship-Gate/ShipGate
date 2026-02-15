# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BillingError, CustomerNotFoundError, PlanNotFoundError, SubscriptionNotFoundError, InvoiceNotFoundError, PaymentFailedError, PaymentMethodRequiredError, InvalidTransitionError, InvalidMoneyOperationError, CurrencyMismatchError, InvoiceNotPayableError, InvoiceNotVoidableError, MeteringError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type BillingError = String
  type CustomerNotFoundError = String
  type PlanNotFoundError = String
  type SubscriptionNotFoundError = String
  type InvoiceNotFoundError = String
  type PaymentFailedError = String
  type PaymentMethodRequiredError = String
  type InvalidTransitionError = String
  type InvalidMoneyOperationError = String
  type CurrencyMismatchError = String
  type InvoiceNotPayableError = String
  type InvoiceNotVoidableError = String
  type MeteringError = String

  invariants exports_present {
    - true
  }
}
