# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: InAppConfig, InAppMessage, InAppChannel
# dependencies: 

domain InApp {
  version: "1.0.0"

  type InAppConfig = String
  type InAppMessage = String
  type InAppChannel = String

  invariants exports_present {
    - true
  }
}
