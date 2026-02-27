/**
 * Channel manager for pub/sub communication
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  MessageId,
  UserId,
  Message,
  SenderType,
  MessageType,
  Priority,
  Clock,
  DefaultClock,
} from '../types.js';
import { SenderType, MessageType } from '../types.js';
import type {
  Channel,
  ChannelSubscription,
  ChannelStore,
  ChannelSubscriptionStore,
  MessageHistoryStore,
  ChannelAuthorizer,
  AuthorizationContext,
  PublishOptions,
  SubscribeOptions,
  UnsubscribeOptions,
  ChannelEventEmitter,
  ChannelEventMap,
  RateLimiter,
  RateLimitConfig,
  ChannelStats,
  ChannelManagerStats,
} from './types.js';
import { ChannelFactory, ChannelImpl } from './channel.js';
import {
  ChannelNotFoundError,
  ChannelExistsError,
  NotSubscribedError,
  SubscriptionLimitError,
  AuthorizationError,
  RateLimitError,
} from '../errors.js';

// ============================================================================
// Channel Manager Implementation
// ============================================================================

export class ChannelManager implements ChannelEventEmitter {
  private readonly eventHandlers = new Map<string, Set<Function>>();
  private messageCounter = 0;

  constructor(
    private readonly channelStore: ChannelStore,
    private readonly subscriptionStore: ChannelSubscriptionStore,
    private readonly historyStore: MessageHistoryStore,
    private readonly authorizer: ChannelAuthorizer,
    private readonly rateLimiter?: RateLimiter,
    private readonly clock: Clock = DefaultClock,
    private readonly options: {
      maxSubscriptionsPerConnection?: number;
      defaultHistorySize?: number;
      cleanupInterval?: number;
    } = {}
  ) {
    if (this.options.cleanupInterval) {
      this.clock.setInterval(() => {
        this.cleanup();
      }, this.options.cleanupInterval);
    }
  }

  // ============================================================================
  // Channel Management
  // ============================================================================

  async createChannel(
    name: string,
    type: ChannelId,
    config: any,
    options?: {
      historyEnabled?: boolean;
      historySize?: number;
      historyTtl?: number;
      public?: boolean;
      allowedPublishers?: string[];
      allowedSubscribers?: string[];
    }
  ): Promise<Channel> {
    const id = this.generateChannelId();
    
    // Check if channel with name already exists
    const existing = await this.channelStore.findByName(name);
    if (existing) {
      throw new ChannelExistsError(existing.id);
    }

    const channel = ChannelFactory.create(id, name, type, config, options);
    await this.channelStore.set(channel);
    
    this.emit('channel:created', { channel });
    return channel;
  }

  async getChannel(id: ChannelId): Promise<Channel | undefined> {
    return this.channelStore.get(id);
  }

  async deleteChannel(id: ChannelId): Promise<boolean> {
    const channel = await this.channelStore.get(id);
    if (!channel) {
      return false;
    }

    // Remove all subscriptions
    const subscriptions = await this.subscriptionStore.getSubscribers(id);
    for (const sub of subscriptions) {
      await this.subscriptionStore.remove(id, sub.connectionId);
      this.emit('subscription:removed', { 
        channelId: id, 
        connectionId: sub.connectionId, 
        reason: 'channel_deleted' 
      });
    }

    // Clear message history
    await this.historyStore.clear(id);

    // Delete channel
    const deleted = await this.channelStore.delete(id);
    if (deleted) {
      this.emit('channel:deleted', { channelId: id });
    }

    return deleted;
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.channelStore.getAll();
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  async subscribe(
    connectionId: ConnectionId,
    channelId: ChannelId,
    options: SubscribeOptions = {}
  ): Promise<{ channel: Channel; history?: Message[] }> {
    const channel = await this.channelStore.get(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    // Check subscription limits
    const subCount = await this.subscriptionStore.countConnection(connectionId);
    if (this.options.maxSubscriptionsPerConnection && 
        subCount >= this.options.maxSubscriptionsPerConnection) {
      throw new SubscriptionLimitError(this.options.maxSubscriptionsPerConnection);
    }

    // Check if already subscribed
    const existing = await this.subscriptionStore.get(channelId, connectionId);
    if (existing) {
      return { channel };
    }

    // Authorize subscription
    const context: AuthorizationContext = {
      connectionId,
      userId: options.userId,
      permissions: options.permissions || [],
      metadata: options.metadata,
    };

    const authResult = await this.authorizer.authorize({
      action: 'subscribe',
      channelId,
      context,
    });

    if (!authResult.allowed) {
      throw new AuthorizationError(channelId, 'subscribe');
    }

    // Create subscription
    const subscription = new ChannelImpl(
      connectionId,
      channelId,
      options.userId,
      authResult.permissions || [],
      options.metadata
    );

    await this.subscriptionStore.add(subscription);

    // Update channel subscriber count
    channel.subscriberCount = await this.subscriptionStore.count(channelId);
    await this.channelStore.set(channel);

    // Get history if requested
    let history: Message[] | undefined;
    if (options.fromHistory && channel.historyEnabled) {
      history = await this.historyStore.get(channelId, options.fromHistory);
    }

    this.emit('subscription:added', { subscription });
    return { channel, history };
  }

  async unsubscribe(
    connectionId: ConnectionId,
    channelId: ChannelId,
    options: UnsubscribeOptions = {}
  ): Promise<void> {
    const subscription = await this.subscriptionStore.get(channelId, connectionId);
    if (!subscription) {
      throw new NotSubscribedError(connectionId, channelId);
    }

    // Authorize unsubscription (always allowed for now)
    const context: AuthorizationContext = {
      connectionId,
      userId: subscription.userId,
      permissions: subscription.permissions,
    };

    const authResult = await this.authorizer.authorize({
      action: 'unsubscribe',
      channelId,
      context,
    });

    if (!authResult.allowed) {
      throw new AuthorizationError(channelId, 'unsubscribe');
    }

    // Remove subscription
    await this.subscriptionStore.remove(channelId, connectionId);

    // Update channel subscriber count
    const channel = await this.channelStore.get(channelId);
    if (channel) {
      channel.subscriberCount = await this.subscriptionStore.count(channelId);
      await this.channelStore.set(channel);
    }

    this.emit('subscription:removed', { 
      channelId, 
      connectionId, 
      reason: options.reason 
    });
  }

  async unsubscribeAll(connectionId: ConnectionId, reason?: string): Promise<void> {
    const subscriptions = await this.subscriptionStore.getSubscriptions(connectionId);
    
    for (const sub of subscriptions) {
      await this.subscriptionStore.remove(sub.channelId, connectionId);
      
      const channel = await this.channelStore.get(sub.channelId);
      if (channel) {
        channel.subscriberCount = await this.subscriptionStore.count(sub.channelId);
        await this.channelStore.set(channel);
      }
      
      this.emit('subscription:removed', { 
        channelId: sub.channelId, 
        connectionId, 
        reason: reason || 'disconnected' 
      });
    }
  }

  async getSubscribers(channelId: ChannelId): Promise<ChannelSubscription[]> {
    return this.subscriptionStore.getSubscribers(channelId);
  }

  async getSubscriptions(connectionId: ConnectionId): Promise<ChannelSubscription[]> {
    return this.subscriptionStore.getSubscriptions(connectionId);
  }

  // ============================================================================
  // Message Publishing
  // ============================================================================

  async publish(
    channelId: ChannelId,
    event: string,
    data: any,
    options: PublishOptions = {}
  ): Promise<{ messageId: MessageId; deliveredTo: number }> {
    const channel = await this.channelStore.get(channelId);
    if (!channel) {
      throw new ChannelNotFoundError(channelId);
    }

    // Check rate limits
    if (this.rateLimiter && channel.config.rateLimit) {
      const rateLimitKey = options.connectionId || `server:${channelId}`;
      const result = await this.rateLimiter.check(rateLimitKey, {
        windowMs: 1000, // 1 second window
        maxRequests: channel.config.rateLimit.messagesPerSecond,
      });

      if (!result.allowed) {
        throw new RateLimitError(result.resetTime.getTime() - Date.now());
      }
    }

    // Validate message
    const message: Message = {
      id: this.generateMessageId(),
      channelId,
      senderId: options.connectionId,
      senderType: options.senderType || (options.connectionId ? SenderType.CLIENT : SenderType.SERVER),
      type: MessageType.EVENT,
      event,
      data,
      timestamp: new Date(),
      priority: options.priority || 'normal',
      ttl: options.ttl,
    };

    channel.validateMessage(message);

    // Store in history if enabled
    if (channel.historyEnabled) {
      await this.historyStore.add(message);
    }

    // Get subscribers
    const subscribers = await this.subscriptionStore.getSubscribers(channelId);
    let targetSubscribers = subscribers;

    // Apply filters
    if (options.exclude && options.exclude.length > 0) {
      targetSubscribers = targetSubscribers.filter(s => !options.exclude!.includes(s.connectionId));
    }

    if (options.targetConnections && options.targetConnections.length > 0) {
      const targetSet = new Set(options.targetConnections);
      targetSubscribers = targetSubscribers.filter(s => targetSet.has(s.connectionId));
    }

    // Deliver message (in a real implementation, this would be async)
    const deliveredTo = targetSubscribers.length;
    const failedConnections: ConnectionId[] = [];

    // Emit event for actual delivery
    this.emit('message:published', { message, deliveredTo });

    if (failedConnections.length > 0) {
      this.emit('message:failed', { message, error: new Error('Delivery failed'), failedConnections });
    }

    return { messageId: message.id, deliveredTo };
  }

  async broadcast(
    event: string,
    data: any,
    filter?: {
      channelTypes?: ChannelId[];
      connectionIds?: ConnectionId[];
      userIds?: UserId[];
    }
  ): Promise<{ deliveredTo: number; failed: number }> {
    const channels = await this.channelStore.getAll();
    let targetChannels = channels;

    // Apply channel type filter
    if (filter?.channelTypes) {
      targetChannels = targetChannels.filter(c => filter.channelTypes!.includes(c.type));
    }

    let totalDelivered = 0;
    let totalFailed = 0;

    for (const channel of targetChannels) {
      try {
        const result = await this.publish(channel.id, event, data, {
          targetConnections: filter?.connectionIds,
        });
        totalDelivered += result.deliveredTo;
      } catch (error) {
        totalFailed++;
        console.error(`Failed to broadcast to channel ${channel.id}:`, error);
      }
    }

    return { deliveredTo: totalDelivered, failed: totalFailed };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getChannelStats(channelId: ChannelId): Promise<ChannelStats | undefined> {
    const channel = await this.channelStore.get(channelId);
    if (!channel) {
      return undefined;
    }

    // In a real implementation, these would be calculated from metrics
    return {
      channelId,
      subscriberCount: channel.subscriberCount,
      messageCount: 0, // Would be tracked
      lastMessageAt: undefined, // Would be tracked
      publishRate: 0, // Would be calculated
      errorRate: 0, // Would be calculated
    };
  }

  async getManagerStats(): Promise<ChannelManagerStats> {
    const channels = await this.channelStore.getAll();
    const totalSubscriptions = await this.getTotalSubscriptionCount();
    
    const channelsByType = channels.reduce((acc, channel) => {
      acc[channel.type] = (acc[channel.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalChannels: channels.length,
      totalSubscriptions,
      totalMessages: this.messageCounter,
      channelsByType: channelsByType as any,
      topChannels: [], // Would be calculated from metrics
    };
  }

  // ============================================================================
  // Event Emitter Implementation
  // ============================================================================

  on<T extends keyof ChannelEventMap>(event: T, handler: (data: ChannelEventMap[T]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off<T extends keyof ChannelEventMap>(event: T, handler: (data: ChannelEventMap[T]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  emit<T extends keyof ChannelEventMap>(event: T, data: ChannelEventMap[T]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in channel event handler for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateChannelId(): ChannelId {
    return `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): MessageId {
    return `msg_${++this.messageCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getTotalSubscriptionCount(): Promise<number> {
    // In a real implementation, this would be optimized
    const channels = await this.channelStore.getAll();
    let total = 0;
    for (const channel of channels) {
      total += channel.subscriberCount;
    }
    return total;
  }

  private async cleanup(): Promise<void> {
    // Clean up expired messages from history
    await this.historyStore.cleanup();
  }
}

// ============================================================================
// In-Memory Stores (for testing/simple deployments)
// ============================================================================

export class InMemoryChannelStore implements ChannelStore {
  private readonly channels = new Map<ChannelId, Channel>();

  async get(id: ChannelId): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async set(channel: Channel): Promise<void> {
    this.channels.set(channel.id, channel);
  }

  async delete(id: ChannelId): Promise<boolean> {
    return this.channels.delete(id);
  }

  async getAll(): Promise<Channel[]> {
    return Array.from(this.channels.values());
  }

  async findByType(type: ChannelType): Promise<Channel[]> {
    return Array.from(this.channels.values()).filter(c => c.type === type);
  }

  async findByName(name: string): Promise<Channel | undefined> {
    return Array.from(this.channels.values()).find(c => c.name === name);
  }

  async count(): Promise<number> {
    return this.channels.size;
  }
}

export class InMemoryChannelSubscriptionStore implements ChannelSubscriptionStore {
  private readonly subscriptions = new Map<string, Map<ConnectionId, ChannelSubscription>>();

  async get(channelId: ChannelId, connectionId: ConnectionId): Promise<ChannelSubscription | undefined> {
    return this.subscriptions.get(channelId)?.get(connectionId);
  }

  async add(subscription: ChannelSubscription): Promise<void> {
    if (!this.subscriptions.has(subscription.channelId)) {
      this.subscriptions.set(subscription.channelId, new Map());
    }
    this.subscriptions.get(subscription.channelId)!.set(subscription.connectionId, subscription);
  }

  async remove(channelId: ChannelId, connectionId: ConnectionId): Promise<boolean> {
    const channelSubs = this.subscriptions.get(channelId);
    if (!channelSubs) {
      return false;
    }
    return channelSubs.delete(connectionId);
  }

  async getSubscribers(channelId: ChannelId): Promise<ChannelSubscription[]> {
    const channelSubs = this.subscriptions.get(channelId);
    return channelSubs ? Array.from(channelSubs.values()) : [];
  }

  async getSubscriptions(connectionId: ConnectionId): Promise<ChannelSubscription[]> {
    const result: ChannelSubscription[] = [];
    for (const channelSubs of this.subscriptions.values()) {
      const sub = channelSubs.get(connectionId);
      if (sub) {
        result.push(sub);
      }
    }
    return result;
  }

  async count(channelId: ChannelId): Promise<number> {
    return this.subscriptions.get(channelId)?.size || 0;
  }

  async countConnection(connectionId: ConnectionId): Promise<number> {
    let count = 0;
    for (const channelSubs of this.subscriptions.values()) {
      if (channelSubs.has(connectionId)) {
        count++;
      }
    }
    return count;
  }
}

export class InMemoryMessageHistoryStore implements MessageHistoryStore {
  private readonly messages = new Map<ChannelId, Message[]>();

  async add(message: Message): Promise<void> {
    if (!this.messages.has(message.channelId)) {
      this.messages.set(message.channelId, []);
    }
    
    const channelMessages = this.messages.get(message.channelId)!;
    channelMessages.push(message);
    
    // Keep only recent messages (simple FIFO)
    if (channelMessages.length > 1000) {
      channelMessages.splice(0, channelMessages.length - 1000);
    }
  }

  async get(channelId: ChannelId, limit?: number, before?: Date): Promise<Message[]> {
    const messages = this.messages.get(channelId) || [];
    let filtered = messages;
    
    if (before) {
      filtered = filtered.filter(m => m.timestamp < before);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  async delete(channelId: ChannelId, messageId: MessageId): Promise<boolean> {
    const messages = this.messages.get(channelId);
    if (!messages) {
      return false;
    }
    
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) {
      return false;
    }
    
    messages.splice(index, 1);
    return true;
  }

  async clear(channelId: ChannelId): Promise<void> {
    this.messages.delete(channelId);
  }

  async cleanup(): Promise<void> {
    // Remove expired messages based on TTL
    const now = new Date();
    for (const [channelId, messages] of this.messages.entries()) {
      const filtered = messages.filter(m => {
        if (!m.ttl) return true;
        return (now.getTime() - m.timestamp.getTime()) < m.ttl;
      });
      this.messages.set(channelId, filtered);
    }
  }
}
