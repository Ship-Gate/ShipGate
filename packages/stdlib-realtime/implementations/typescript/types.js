// ============================================================================
// Core Realtime Types
// @isl-lang/stdlib-realtime
// ============================================================================
// ============================================================================
// Connection Types
// ============================================================================
/** Communication protocol */
export var Protocol;
(function (Protocol) {
    Protocol["WEBSOCKET"] = "WEBSOCKET";
    Protocol["SSE"] = "SSE";
    Protocol["LONG_POLLING"] = "LONG_POLLING";
    Protocol["WEBRTC_DATA"] = "WEBRTC_DATA";
})(Protocol || (Protocol = {}));
/** Network transport layer */
export var Transport;
(function (Transport) {
    Transport["TCP"] = "TCP";
    Transport["TLS"] = "TLS";
    Transport["HTTP2"] = "HTTP2";
})(Transport || (Transport = {}));
/** Connection lifecycle status */
export var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["CONNECTING"] = "CONNECTING";
    ConnectionStatus["CONNECTED"] = "CONNECTED";
    ConnectionStatus["AUTHENTICATED"] = "AUTHENTICATED";
    ConnectionStatus["DISCONNECTING"] = "DISCONNECTING";
    ConnectionStatus["DISCONNECTED"] = "DISCONNECTED";
    ConnectionStatus["ERROR"] = "ERROR";
})(ConnectionStatus || (ConnectionStatus = {}));
// ============================================================================
// Channel Types
// ============================================================================
/** Channel type enumeration */
export var ChannelType;
(function (ChannelType) {
    /** One-to-many, all subscribers receive */
    ChannelType["BROADCAST"] = "BROADCAST";
    /** Track who's online in channel */
    ChannelType["PRESENCE"] = "PRESENCE";
    /** One-to-one private channel */
    ChannelType["DIRECT"] = "DIRECT";
    /** Many-to-many group communication */
    ChannelType["ROOM"] = "ROOM";
    /** Broadcast to all connected clients */
    ChannelType["FANOUT"] = "FANOUT";
})(ChannelType || (ChannelType = {}));
// ============================================================================
// Message Types
// ============================================================================
/** Who sent the message */
export var SenderType;
(function (SenderType) {
    SenderType["CLIENT"] = "CLIENT";
    SenderType["SERVER"] = "SERVER";
    SenderType["SYSTEM"] = "SYSTEM";
})(SenderType || (SenderType = {}));
/** Type of message content */
export var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "TEXT";
    MessageType["BINARY"] = "BINARY";
    MessageType["JSON"] = "JSON";
    MessageType["EVENT"] = "EVENT";
    MessageType["PING"] = "PING";
    MessageType["PONG"] = "PONG";
    MessageType["CLOSE"] = "CLOSE";
})(MessageType || (MessageType = {}));
/** Message priority levels */
export var Priority;
(function (Priority) {
    Priority["LOW"] = "LOW";
    Priority["NORMAL"] = "NORMAL";
    Priority["HIGH"] = "HIGH";
    Priority["CRITICAL"] = "CRITICAL";
})(Priority || (Priority = {}));
/** Delivery status for messages */
export var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["PENDING"] = "PENDING";
    DeliveryStatus["DELIVERING"] = "DELIVERING";
    DeliveryStatus["DELIVERED"] = "DELIVERED";
    DeliveryStatus["PARTIAL"] = "PARTIAL";
    DeliveryStatus["FAILED"] = "FAILED";
})(DeliveryStatus || (DeliveryStatus = {}));
// ============================================================================
// Presence Types
// ============================================================================
/** Presence status */
export var PresenceStatus;
(function (PresenceStatus) {
    PresenceStatus["ONLINE"] = "ONLINE";
    PresenceStatus["AWAY"] = "AWAY";
    PresenceStatus["BUSY"] = "BUSY";
    PresenceStatus["INVISIBLE"] = "INVISIBLE";
    PresenceStatus["OFFLINE"] = "OFFLINE";
})(PresenceStatus || (PresenceStatus = {}));
// ============================================================================
// Room Types
// ============================================================================
/** Role within a room */
export var RoomRole;
(function (RoomRole) {
    RoomRole["OWNER"] = "OWNER";
    RoomRole["ADMIN"] = "ADMIN";
    RoomRole["MODERATOR"] = "MODERATOR";
    RoomRole["MEMBER"] = "MEMBER";
    RoomRole["GUEST"] = "GUEST";
})(RoomRole || (RoomRole = {}));
// ============================================================================
// Error Types
// ============================================================================
/** Realtime error codes */
export var RealtimeErrorCode;
(function (RealtimeErrorCode) {
    RealtimeErrorCode["CONNECTION_REFUSED"] = "CONNECTION_REFUSED";
    RealtimeErrorCode["AUTH_REQUIRED"] = "AUTH_REQUIRED";
    RealtimeErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    RealtimeErrorCode["CONNECTION_NOT_FOUND"] = "CONNECTION_NOT_FOUND";
    RealtimeErrorCode["CHANNEL_NOT_FOUND"] = "CHANNEL_NOT_FOUND";
    RealtimeErrorCode["NOT_AUTHORIZED"] = "NOT_AUTHORIZED";
    RealtimeErrorCode["MAX_SUBSCRIPTIONS"] = "MAX_SUBSCRIPTIONS";
    RealtimeErrorCode["MESSAGE_TOO_LARGE"] = "MESSAGE_TOO_LARGE";
    RealtimeErrorCode["TARGET_NOT_FOUND"] = "TARGET_NOT_FOUND";
    RealtimeErrorCode["TARGET_OFFLINE"] = "TARGET_OFFLINE";
    RealtimeErrorCode["NOT_SUBSCRIBED"] = "NOT_SUBSCRIBED";
    RealtimeErrorCode["ROOM_EXISTS"] = "ROOM_EXISTS";
    RealtimeErrorCode["ROOM_FULL"] = "ROOM_FULL";
    RealtimeErrorCode["BANNED"] = "BANNED";
    RealtimeErrorCode["NOT_SUPPORTED"] = "NOT_SUPPORTED";
})(RealtimeErrorCode || (RealtimeErrorCode = {}));
/** Base error for realtime operations */
export class RealtimeError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'RealtimeError';
    }
}
//# sourceMappingURL=types.js.map