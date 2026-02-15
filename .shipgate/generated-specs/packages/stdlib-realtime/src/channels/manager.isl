# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ChannelManager, InMemoryChannelStore, InMemoryChannelSubscriptionStore, InMemoryMessageHistoryStore
# dependencies: 

domain Manager {
  version: "1.0.0"

  type ChannelManager = String
  type InMemoryChannelStore = String
  type InMemoryChannelSubscriptionStore = String
  type InMemoryMessageHistoryStore = String

  invariants exports_present {
    - true
  }
}
