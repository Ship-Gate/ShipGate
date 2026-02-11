/**
 * Channel types for pub/sub communication
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  MessageId,
  UserId,
  ChannelType,
  ChannelConfig,
  Message,
  SenderType,
  MessageType,
  Priority,
  Clock,
} from '../types.js';

// ============================================================================
// Channel Types
// ============================================================================

export interface Channel {
  readonly id: ChannelId;
  readonly name: string;
  readonly type: ChannelType;
  readonly config: ChannelConfig;
  subscriberCount: number;
  readonly createdAt: Date;
  historyEnabled?: boolean;
  historySize?: number;
  historyTtl?: number;
  public?: boolean;
  allowedPublishers?: string[];
  allowedSubscribers?: string[];
}

export interface ChannelSubscription {
  readonly connectionId: ConnectionId;
  readonly channelId: ChannelId;
  readonly userId?: UserId;
  readonly subscribedAt: Date;
  readonly permissions: string[];
  metadata?: Record<string, any>;
}

export interface PublishOptions {
  connectionId?: ConnectionId;
  senderType?: SenderType;
  priority?: Priority;
  ttl?: number;
  exclude?: ConnectionId[];
  targetConnections?: ConnectionId[];
}

export interface SubscribeOptions {
  userId?: UserId;
  permissions?: string[];
  metadata?: Record<string, any>;
  fromHistory?: number;
}

export interface UnsubscribeOptions {
  reason?: string;
}

// ============================================================================
// Channel Store Interface
// ============================================================================

export interface ChannelStore {
  get(id: ChannelId): Promise<Channel | undefined>;
  set(channel: Channel): Promise<void>;
  delete(id: ChannelId): Promise<boolean>;
  getAll(): Promise<Channel[]>;
  findByType(type: ChannelType): Promise<Channel[]>;
  findByName(name: string): Promise<Channel | undefined>;
  count(): Promise<number>;
}

export interface ChannelSubscriptionStore {
  get(channelId: ChannelId, connectionId: ConnectionId): Promise<ChannelSubscription | undefined>;
  add(subscription: ChannelSubscription): Promise<void>;
  remove(channelId: ChannelId, connectionId: ConnectionId): Promise<boolean>;
  getSubscribers(channelId: ChannelId): Promise<ChannelSubscription[]>;
  getSubscriptions(connectionId: ConnectionId): Promise<ChannelSubscription[]>;
  count(channelId: ChannelId): Promise<number>;
  countConnection(connectionId: ChannelId): Promise<number>;
}

export interface MessageHistoryStore {
  add(message: Message): Promise<void>;
  get(channelId: ChannelId, limit?: number, before?: Date): Promise<Message[]>;
  delete(channelId: ChannelId, messageId: MessageId): Promise<boolean>;
  clear(channelId: ChannelId): Promise<void>;
  cleanup(): Promise<void>; // Remove expired messages
}

// ============================================================================
// Authorization Types
// ============================================================================

export interface AuthorizationContext {
  connectionId: ConnectionId;
  userId?: UserId;
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface AuthorizationRequest {
  action: 'subscribe' | 'publish' | 'unsubscribe';
  channelId: ChannelId;
  context: AuthorizationContext;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  permissions?: string[];
}

export interface ChannelAuthorizer {
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
}

// ============================================================================
// Channel Manager Events
// ============================================================================

export interface ChannelEventMap {
  'channel:created': { channel: Channel };
  'channel:deleted': { channelId: ChannelId };
  'subscription:added': { subscription: ChannelSubscription };
  'subscription:removed': { channelId: ChannelId; connectionId: ConnectionId; reason?: string };
  'message:published': { message: Message; deliveredTo: number };
  'message:failed': { message: Message; error: Error; failedConnections: ConnectionId[] };
}

export type ChannelEvent = keyof ChannelEventMap;

export interface ChannelEventHandler<T extends ChannelEvent> {
  (data: ChannelEventMap[T]): void | Promise<void>;
}

export interface ChannelEventEmitter {
  on<T extends ChannelEvent>(event: T, handler: ChannelEventHandler<T>): void;
  off<T extends ChannelEvent>(event: T, handler: ChannelEventHandler<T>): void;
  emit<T extends ChannelEvent>(event: T, data: ChannelEventMap[T]): void;
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalHits: number;
}

export interface RateLimiter {
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

// ============================================================================
// Channel Statistics
// ============================================================================

export interface ChannelStats {
  channelId: ChannelId;
  subscriberCount: number;
  messageCount: number;
  lastMessageAt?: Date;
  publishRate: number; // messages per second
  errorRate: number; // errors per second
}

export interface ChannelManagerStats {
  totalChannels: number;
  totalSubscriptions: number;
  totalMessages: number;
  channelsByType: Record<ChannelType, number>;
  topChannels: ChannelStats[];
}

// ============================================================================
// Channel Filters
// ============================================================================

export interface MessageFilter {
  eventType?: string;
  senderType?: SenderType;
  priority?: Priority;
  minPriority?: Priority;
  custom?: (message: Message) => boolean;
}

export interface SubscriptionFilter {
  userId?: UserId;
  connectionId?: ConnectionId;
  permissions?: string[];
  metadata?: Record<string, any>;
  custom?: (subscription: ChannelSubscription) => boolean;
}
