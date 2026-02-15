# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultPresenceTracker, InMemoryPresenceStore
# dependencies: 

domain Tracker {
  version: "1.0.0"

  type DefaultPresenceTracker = String
  type InMemoryPresenceStore = String

  invariants exports_present {
    - true
  }
}
