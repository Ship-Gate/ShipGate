# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ConnectionId, ChannelId, MessageId, ClientId, Connection, RateLimit, ChannelConfig, Channel, Message, DeviceInfo, Presence, SSEEvent, ConnectResult, SubscribeResult, PublishResult, BroadcastResult
# dependencies: 

domain TypesD {
  version: "1.0.0"

  type ConnectionId = String
  type ChannelId = String
  type MessageId = String
  type ClientId = String
  type Connection = String
  type RateLimit = String
  type ChannelConfig = String
  type Channel = String
  type Message = String
  type DeviceInfo = String
  type Presence = String
  type SSEEvent = String
  type ConnectResult = String
  type SubscribeResult = String
  type PublishResult = String
  type BroadcastResult = String

  invariants exports_present {
    - true
  }
}
