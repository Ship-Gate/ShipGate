# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ChargeStatus, ChargeRequest, ChargeResult, RefundRequest, RefundResult, CustomerRecord
# dependencies: 

domain Types {
  version: "1.0.0"

  type ChargeStatus = String
  type ChargeRequest = String
  type ChargeResult = String
  type RefundRequest = String
  type RefundResult = String
  type CustomerRecord = String

  invariants exports_present {
    - true
  }
}
