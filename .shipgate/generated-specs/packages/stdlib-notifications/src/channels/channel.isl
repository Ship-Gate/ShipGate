# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ChannelMessage, ChannelResponse, ChannelConfig, EmailAddress, SmsAddress, PushAddress, WebhookAddress, InAppAddress
# dependencies: 

domain Channel {
  version: "1.0.0"

  type ChannelMessage = String
  type ChannelResponse = String
  type ChannelConfig = String
  type EmailAddress = String
  type SmsAddress = String
  type PushAddress = String
  type WebhookAddress = String
  type InAppAddress = String

  invariants exports_present {
    - true
  }
}
