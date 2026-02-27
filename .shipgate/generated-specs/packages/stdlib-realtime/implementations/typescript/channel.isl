# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createChannel, canPublish, canSubscribe, DEFAULT_CHANNEL_CONFIG, InMemoryChannelStore, ChannelManager
# dependencies: 

domain Channel {
  version: "1.0.0"

  type InMemoryChannelStore = String
  type ChannelManager = String

  invariants exports_present {
    - true
  }
}
