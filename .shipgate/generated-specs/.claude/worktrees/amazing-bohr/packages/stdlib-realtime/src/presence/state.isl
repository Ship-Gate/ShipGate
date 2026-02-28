# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultPresenceStateManager, PresenceEvent
# dependencies: 

domain State {
  version: "1.0.0"

  type DefaultPresenceStateManager = String
  type PresenceEvent = String

  invariants exports_present {
    - true
  }
}
