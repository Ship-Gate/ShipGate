# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SmtpConfig, SmtpProvider
# dependencies: 

domain Smtp {
  version: "1.0.0"

  type SmtpConfig = String
  type SmtpProvider = String

  invariants exports_present {
    - true
  }
}
