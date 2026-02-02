// ============================================================================
// Core Realtime Types
// @isl-lang/stdlib-realtime
// ============================================================================

/** Unique identifier for a connection */
export type ConnectionId = string;

/** Identifier for a channel */
export type ChannelId = string;

/** Unique identifier for a message */
export type MessageId = string;

/** Client identifier */
export type ClientId = string;

// ============================================================================
// Connection Types
// ============================================================================

/** Communication protocol */
export enum Protocol {
  WEBSOCKET = 'WEBSOCKET',
  SSE = 'SSE',
  LONG_POLLING = 'LONG_POLLING',
  WEBRTC_DATA = 'WEBRTC_DATA',
}

/** Network transport layer */
export enum Transport {
  TCP = 'TCP',
  TLS = 'TLS',
  HTTP2 = 'HTTP2',
}

/** Connection lifecycle status */
export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  AUTHENTICATED = 'AUTHENTICATED',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

/** Connection information */
export interface Connection {
  readonly id: ConnectionId;
  readonly clientId: ClientId;
  readonly protocol: Protocol;
  readonly transport: Transport;
  status: ConnectionStatus;
  readonly connectedAt: Date;
  lastActivityAt: Date;
  userId?: string;
  authToken?: string;
  permissions?: string[];
  subscribedChannels: ChannelId[];
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, string>;
  lastPingAt?: Date;
  lastPongAt?: Date;
}

// ============================================================================
// Channel Types
// ============================================================================

/** Channel type enumeration */
export enum ChannelType {
  /** One-to-many, all subscribers receive */
  BROADCAST = 'BROADCAST',
  /** Track who's online in channel */
  PRESENCE = 'PRESENCE',
  /** One-to-one private channel */
  DIRECT = 'DIRECT',
  /** Many-to-many group communication */
  ROOM = 'ROOM',
  /** Broadcast to all connected clients */
  FANOUT = 'FANOUT',
}

/** Rate limit configuration */
export interface RateLimit {
  messagesPerSecond: number;
  burst?: number;
}

/** Channel configuration */
export interface ChannelConfig {
  maxSubscribers?: number;
  maxMessageSize: number;
  rateLimit?: RateLimit;
  requireAuth: boolean;
  encryption: boolean;
}

/** Channel entity */
export interface Channel {
  readonly id: ChannelId;
  name: string;
  type: ChannelType;
  config: ChannelConfig;
  subscriberCount: number;
  readonly createdAt: Date;
  historyEnabled: boolean;
  historySize?: number;
  historyTtlMs?: number;
  public: boolean;
  allowedPublishers?: string[];
  allowedSubscribers?: string[];
}

// ============================================================================
// Message Types
// ============================================================================

/** Who sent the message */
export enum SenderType {
  CLIENT = 'CLIENT',
  SERVER = 'SERVER',
  SYSTEM = 'SYSTEM',
}

/** Type of message content */
export enum MessageType {
  TEXT = 'TEXT',
  BINARY = 'BINARY',
  JSON = 'JSON',
  EVENT = 'EVENT',
  PING = 'PING',
  PONG = 'PONG',
  CLOSE = 'CLOSE',
}

/** Message priority levels */
export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Delivery status for messages */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

/** Message entity */
export interface Message<TData = unknown> {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly senderId?: ConnectionId;
  readonly senderType: SenderType;
  readonly type: MessageType;
  readonly event: string;
  readonly data: TData;
  readonly timestamp: Date;
  ttlMs?: number;
  priority: Priority;
  deliveryStatus?: DeliveryStatus;
  deliveredTo?: number;
  failedCount?: number;
}

// ============================================================================
// Presence Types
// ============================================================================

/** Presence status */
export enum PresenceStatus {
  ONLINE = 'ONLINE',
  AWAY = 'AWAY',
  BUSY = 'BUSY',
  INVISIBLE = 'INVISIBLE',
  OFFLINE = 'OFFLINE',
}

/** Device information for presence */
export interface DeviceInfo {
  type?: string;
  name?: string;
}

/** Presence tracking entity */
export interface Presence {
  readonly channelId: ChannelId;
  readonly userId: string;
  readonly connectionId: ConnectionId;
  status: PresenceStatus;
  customState?: Record<string, unknown>;
  readonly joinedAt: Date;
  lastSeenAt: Date;
  deviceInfo?: DeviceInfo;
}

// ============================================================================
// Room Types
// ============================================================================

/** Role within a room */
export enum RoomRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

// ============================================================================
// SSE Types
// ============================================================================

/** Server-Sent Event structure */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// ============================================================================
// Result Types
// ============================================================================

/** Connect behavior result */
export interface ConnectResult {
  connectionId: ConnectionId;
  clientId: ClientId;
  protocol: Protocol;
}

/** Subscribe behavior result */
export interface SubscribeResult {
  channelId: ChannelId;
  history?: Message[];
  presence?: Presence[];
}

/** Publish behavior result */
export interface PublishResult {
  messageId: MessageId;
  deliveredTo: number;
}

/** Broadcast behavior result */
export interface BroadcastResult {
  deliveredTo: number;
  failed: number;
}

// ============================================================================
// Error Types
// ============================================================================

/** Realtime error codes */
export enum RealtimeErrorCode {
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  MAX_SUBSCRIPTIONS = 'MAX_SUBSCRIPTIONS',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',
  TARGET_OFFLINE = 'TARGET_OFFLINE',
  NOT_SUBSCRIBED = 'NOT_SUBSCRIBED',
  ROOM_EXISTS = 'ROOM_EXISTS',
  ROOM_FULL = 'ROOM_FULL',
  BANNED = 'BANNED',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
}

/** Base error for realtime operations */
export class RealtimeError extends Error {
  constructor(
    public readonly code: RealtimeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}
