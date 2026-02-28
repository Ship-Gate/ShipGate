# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ProtocolErrorCodes, CURRENT_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, MessageFlags, ProtocolMessage, ProtocolHeader, ProtocolPayload, ProtocolPacket, PingMessage, PongMessage, EventMessage, SubscribeMessage, UnsubscribeMessage, PublishMessage, PresenceMessage, AuthMessage, ErrorMessage, ProtocolError, ProtocolErrorCode, ProtocolCodec, HeartbeatConfig, HeartbeatManager, ProtocolVersion, CodecStats, MessageFlag, ProtocolConfig, ProtocolTransport, ProtocolHandler, ProtocolRegistry, FlowControlWindow, FlowControlManager
# dependencies: 

domain Types {
  version: "1.0.0"

  type ProtocolMessage = String
  type ProtocolHeader = String
  type ProtocolPayload = String
  type ProtocolPacket = String
  type PingMessage = String
  type PongMessage = String
  type EventMessage = String
  type SubscribeMessage = String
  type UnsubscribeMessage = String
  type PublishMessage = String
  type PresenceMessage = String
  type AuthMessage = String
  type ErrorMessage = String
  type ProtocolError = String
  type ProtocolErrorCode = String
  type ProtocolCodec = String
  type HeartbeatConfig = String
  type HeartbeatManager = String
  type ProtocolVersion = String
  type CodecStats = String
  type MessageFlag = String
  type ProtocolConfig = String
  type ProtocolTransport = String
  type ProtocolHandler = String
  type ProtocolRegistry = String
  type FlowControlWindow = String
  type FlowControlManager = String

  invariants exports_present {
    - true
  }
}
