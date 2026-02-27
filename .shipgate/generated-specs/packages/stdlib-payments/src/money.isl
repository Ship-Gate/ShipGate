# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: money, cents, calculateTax, calculateDiscount, calculateTotal, exchangeCurrency, isValidCurrency, getCurrencyPrecision, MoneyValue
# dependencies: 

domain Money {
  version: "1.0.0"

  type MoneyValue = String

  invariants exports_present {
    - true
  }
}
