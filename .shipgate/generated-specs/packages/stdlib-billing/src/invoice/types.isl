# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LineItem, TaxLine, Invoice, CreateInvoiceInput, PayInvoiceInput, PayInvoiceResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type LineItem = String
  type TaxLine = String
  type Invoice = String
  type CreateInvoiceInput = String
  type PayInvoiceInput = String
  type PayInvoiceResult = String

  invariants exports_present {
    - true
  }
}
