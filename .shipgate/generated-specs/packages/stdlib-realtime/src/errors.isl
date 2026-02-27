# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isRealtimeError, isConnectionError, isChannelError, isMessageError, isPresenceError, isRoomError, isProtocolError, isSSEError, RealtimeError, ConnectionError, ConnectionRefusedError, ConnectionNotFoundError, ConnectionTimeoutError, ConnectionLimitExceededError, AuthenticationError, AuthorizationError, ChannelError, ChannelNotFoundError, ChannelExistsError, SubscriptionLimitError, NotSubscribedError, MessageError, MessageTooLargeError, RateLimitError, MessageDeliveryError, PresenceError, PresenceNotFoundError, RoomError, RoomNotFoundError, RoomExistsError, RoomFullError, BannedError, ProtocolError, InvalidMessageFormatError, UnsupportedProtocolError, SSEError, SSENotSupportedError, ErrorFactory
# dependencies: 

domain Errors {
  version: "1.0.0"

  type RealtimeError = String
  type ConnectionError = String
  type ConnectionRefusedError = String
  type ConnectionNotFoundError = String
  type ConnectionTimeoutError = String
  type ConnectionLimitExceededError = String
  type AuthenticationError = String
  type AuthorizationError = String
  type ChannelError = String
  type ChannelNotFoundError = String
  type ChannelExistsError = String
  type SubscriptionLimitError = String
  type NotSubscribedError = String
  type MessageError = String
  type MessageTooLargeError = String
  type RateLimitError = String
  type MessageDeliveryError = String
  type PresenceError = String
  type PresenceNotFoundError = String
  type RoomError = String
  type RoomNotFoundError = String
  type RoomExistsError = String
  type RoomFullError = String
  type BannedError = String
  type ProtocolError = String
  type InvalidMessageFormatError = String
  type UnsupportedProtocolError = String
  type SSEError = String
  type SSENotSupportedError = String
  type ErrorFactory = String

  invariants exports_present {
    - true
  }
}
