# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SmsConfig, SmsChannel
# dependencies: 

domain Sms {
  version: "1.0.0"

  type SmsConfig = String
  type SmsChannel = String

  invariants exports_present {
    - true
  }
}
