# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ReceiptOptions, ReceiptTemplate, ReceiptField, ReceiptLineItem, ReceiptData, BillingDetails, ShippingDetails, TaxDetails, TaxBreakdown, PaymentDetails, ReceiptManager
# dependencies: 

domain Receipt {
  version: "1.0.0"

  type ReceiptOptions = String
  type ReceiptTemplate = String
  type ReceiptField = String
  type ReceiptLineItem = String
  type ReceiptData = String
  type BillingDetails = String
  type ShippingDetails = String
  type TaxDetails = String
  type TaxBreakdown = String
  type PaymentDetails = String
  type ReceiptManager = String

  invariants exports_present {
    - true
  }
}
