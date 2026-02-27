# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SendGridConfig, SendGridProvider
# dependencies: 

domain Sendgrid {
  version: "1.0.0"

  type SendGridConfig = String
  type SendGridProvider = String

  invariants exports_present {
    - true
  }
}
