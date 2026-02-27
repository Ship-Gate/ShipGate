/**
 * Core types for realtime communication
 * @packageDocumentation
 */

// ============================================================================
// Basic Types
// ============================================================================

export type ConnectionId = string;
export type ChannelId = string;
export type MessageId = string;
export type ClientId = string;
export type UserId = string;

// ============================================================================
// Enums
// ============================================================================

export enum Protocol {
  WEBSOCKET = 'websocket',
  SSE = 'sse',
  LONG_POLLING = 'long_polling',
  WEBRTC_DATA = 'webrtc_data',
}

export enum Transport {
  TCP = 'tcp',
  TLS = 'tls',
  HTTP2 = 'http2',
}

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export enum ChannelType {
  BROADCAST = 'broadcast',
  PRESENCE = 'presence',
  DIRECT = 'direct',
  ROOM = 'room',
  FANOUT = 'fanout',
}

export enum SenderType {
  CLIENT = 'client',
  SERVER = 'server',
  SYSTEM = 'system',
}

export enum MessageType {
  TEXT = 'text',
  BINARY = 'binary',
  JSON = 'json',
  EVENT = 'event',
  PING = 'ping',
  PONG = 'pong',
  CLOSE = 'close',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum DeliveryStatus {
  PENDING = 'pending',
  DELIVERING = 'delivering',
  DELIVERED = 'delivered',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  INVISIBLE = 'invisible',
  OFFLINE = 'offline',
}

export enum RoomRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest',
}

// ============================================================================
// Interfaces
// ============================================================================

export interface ConnectionInfo {
  id: ConnectionId;
  clientId: ClientId;
  protocol: Protocol;
  transport: Transport;
  status: ConnectionStatus;
  connectedAt: Date;
  lastActivityAt: Date;
  userId?: UserId;
  authToken?: string;
  permissions?: string[];
  subscribedChannels: ChannelId[];
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, string>;
  lastPingAt?: Date;
  lastPongAt?: Date;
}

export interface ChannelConfig {
  maxSubscribers?: number;
  maxMessageSize?: number;
  rateLimit?: {
    messagesPerSecond: number;
    burst?: number;
  };
  requireAuth?: boolean;
  encryption?: boolean;
}

export interface ChannelInfo {
  id: ChannelId;
  name: string;
  type: ChannelType;
  config: ChannelConfig;
  subscriberCount: number;
  createdAt: Date;
  historyEnabled?: boolean;
  historySize?: number;
  historyTtl?: number;
  public?: boolean;
  allowedPublishers?: string[];
  allowedSubscribers?: string[];
}

export interface Message {
  id: MessageId;
  channelId: ChannelId;
  senderId?: ConnectionId;
  senderType: SenderType;
  type: MessageType;
  event: string;
  data: any;
  timestamp: Date;
  ttl?: number;
  priority: Priority;
  deliveryStatus?: DeliveryStatus;
  deliveredTo?: number;
  failedCount?: number;
}

export interface PresenceInfo {
  channelId: ChannelId;
  userId: UserId;
  connectionId: ConnectionId;
  status: PresenceStatus;
  customState?: Record<string, any>;
  joinedAt: Date;
  lastSeenAt: Date;
  deviceInfo?: {
    type?: string;
    name?: string;
  };
}

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface ConnectOptions {
  protocol?: Protocol;
  authToken?: string;
  metadata?: Record<string, string>;
  userAgent?: string;
  ipAddress?: string;
}

export interface ConnectResult {
  connectionId: ConnectionId;
  clientId: ClientId;
  protocol: Protocol;
}

export interface SubscribeOptions {
  fromHistory?: number;
}

export interface SubscribeResult {
  channelId: ChannelId;
  history?: Message[];
  presence?: PresenceInfo[];
}

export interface PublishOptions {
  connectionId?: ConnectionId;
  exclude?: ConnectionId[];
}

export interface PublishResult {
  messageId: MessageId;
  deliveredTo: number;
}

export interface BroadcastOptions {
  filter?: {
    userIds?: UserId[];
    metadata?: Record<string, string>;
  };
}

export interface BroadcastResult {
  deliveredTo: number;
  failed: number;
}

export interface DirectMessageResult {
  delivered: boolean;
}

export interface PresenceUpdateResult {
  presence: PresenceInfo;
}

export interface RoomConfig {
  maxParticipants?: number;
  public?: boolean;
  persistent?: boolean;
}

export interface CreateRoomResult {
  channel: ChannelInfo;
}

export interface JoinRoomResult {
  room: ChannelInfo;
  participants: PresenceInfo[];
}

// ============================================================================
// Clock interface for dependency injection
// ============================================================================

export interface Clock {
  now(): Date;
  setTimeout(callback: () => void, delay: number): any;
  clearTimeout(timer: any): void;
  setInterval(callback: () => void, interval: number): any;
  clearInterval(timer: any): void;
}

// ============================================================================
// Default clock implementation
// ============================================================================

export const DefaultClock: Clock = {
  now: () => new Date(),
  setTimeout: (cb, delay) => setTimeout(cb, delay),
  clearTimeout: (timer) => clearTimeout(timer),
  setInterval: (cb, interval) => setInterval(cb, interval),
  clearInterval: (timer) => clearInterval(timer),
};

// ============================================================================
// Reconnection strategy
// ============================================================================

export interface ReconnectStrategy {
  shouldReconnect(attempt: number, error?: Error): boolean;
  getDelay(attempt: number): number;
}

export class ExponentialBackoff implements ReconnectStrategy {
  constructor(
    private readonly maxAttempts: number = 10,
    private readonly initialDelay: number = 1000,
    private readonly maxDelay: number = 30000,
    private readonly backoffFactor: number = 2
  ) {}

  shouldReconnect(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }

  getDelay(attempt: number): number {
    const delay = this.initialDelay * Math.pow(this.backoffFactor, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }
}

export class FixedDelay implements ReconnectStrategy {
  constructor(
    private readonly maxAttempts: number = 10,
    private readonly delay: number = 5000
  ) {}

  shouldReconnect(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }

  getDelay(): number {
    return this.delay;
  }
}

// ============================================================================
// Event types
// ============================================================================

export interface RealtimeEventMap {
  'connection:established': { connectionId: ConnectionId };
  'connection:closed': { connectionId: ConnectionId; code?: number; reason?: string };
  'connection:error': { connectionId: ConnectionId; error: Error };
  'subscription:created': { connectionId: ConnectionId; channelId: ChannelId };
  'subscription:removed': { connectionId: ConnectionId; channelId: ChannelId };
  'message:published': { messageId: MessageId; channelId: ChannelId };
  'message:received': { message: Message; connectionId: ConnectionId };
  'presence:joined': { presence: PresenceInfo };
  'presence:left': { channelId: ChannelId; userId: UserId; connectionId: ConnectionId };
  'presence:updated': { presence: PresenceInfo };
  'channel:created': { channel: ChannelInfo };
  'channel:deleted': { channelId: ChannelId };
}

export type RealtimeEvent = keyof RealtimeEventMap;

export interface EventHandler<T extends RealtimeEvent> {
  (data: RealtimeEventMap[T]): void | Promise<void>;
}

export interface EventEmitter {
  on<T extends RealtimeEvent>(event: T, handler: EventHandler<T>): void;
  off<T extends RealtimeEvent>(event: T, handler: EventHandler<T>): void;
  emit<T extends RealtimeEvent>(event: T, data: RealtimeEventMap[T]): void;
}
