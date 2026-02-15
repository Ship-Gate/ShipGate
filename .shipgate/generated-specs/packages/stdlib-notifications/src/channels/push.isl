# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PushConfig, PushMessage, PushChannel
# dependencies: 

domain Push {
  version: "1.0.0"

  type PushConfig = String
  type PushMessage = String
  type PushChannel = String

  invariants exports_present {
    - true
  }
}
