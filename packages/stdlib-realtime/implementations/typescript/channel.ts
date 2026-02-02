// ============================================================================
// Channel Management (Pub/Sub)
// @isl-lang/stdlib-realtime
// ============================================================================

import type {
  Channel,
  ChannelId,
  ChannelConfig,
  Connection,
  ConnectionId,
  SubscribeResult,
  Message,
} from './types.js';
import {
  ChannelType,
  RealtimeError,
  RealtimeErrorCode,
} from './types.js';

/** Default channel configuration */
export const DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
  maxMessageSize: 65536,
  requireAuth: false,
  encryption: false,
};

/** Channel store interface */
export interface ChannelStore {
  get(id: ChannelId): Channel | undefined;
  set(channel: Channel): void;
  delete(id: ChannelId): boolean;
  getAll(): Channel[];
  findByType(type: ChannelType): Channel[];
}

/** In-memory channel store */
export class InMemoryChannelStore implements ChannelStore {
  private channels = new Map<ChannelId, Channel>();

  get(id: ChannelId): Channel | undefined {
    return this.channels.get(id);
  }

  set(channel: Channel): void {
    this.channels.set(channel.id, channel);
  }

  delete(id: ChannelId): boolean {
    return this.channels.delete(id);
  }

  getAll(): Channel[] {
    return Array.from(this.channels.values());
  }

  findByType(type: ChannelType): Channel[] {
    return this.getAll().filter(ch => ch.type === type);
  }
}

/** Channel manager options */
export interface ChannelManagerOptions {
  store?: ChannelStore;
  maxSubscriptionsPerConnection?: number;
  defaultHistorySize?: number;
}

/** Channel manager for pub/sub operations */
export class ChannelManager {
  private readonly store: ChannelStore;
  private readonly maxSubscriptionsPerConnection: number;
  private readonly defaultHistorySize: number;
  private readonly subscriptions = new Map<ChannelId, Set<ConnectionId>>();
  private readonly messageHistory = new Map<ChannelId, Message[]>();

  constructor(options: ChannelManagerOptions = {}) {
    this.store = options.store ?? new InMemoryChannelStore();
    this.maxSubscriptionsPerConnection = options.maxSubscriptionsPerConnection ?? 100;
    this.defaultHistorySize = options.defaultHistorySize ?? 100;
  }

  /**
   * Create a new channel
   */
  createChannel(params: {
    id?: ChannelId;
    name: string;
    type?: ChannelType;
    config?: Partial<ChannelConfig>;
    public?: boolean;
    historyEnabled?: boolean;
    historySize?: number;
  }): Channel {
    const channelId = params.id ?? params.name;
    
    if (this.store.get(channelId)) {
      throw new RealtimeError(
        RealtimeErrorCode.ROOM_EXISTS,
        `Channel ${channelId} already exists`
      );
    }

    const channel: Channel = {
      id: channelId,
      name: params.name,
      type: params.type ?? ChannelType.BROADCAST,
      config: { ...DEFAULT_CHANNEL_CONFIG, ...params.config },
      subscriberCount: 0,
      createdAt: new Date(),
      historyEnabled: params.historyEnabled ?? false,
      historySize: params.historySize ?? this.defaultHistorySize,
      public: params.public ?? false,
    };

    this.store.set(channel);
    this.subscriptions.set(channelId, new Set());

    if (channel.historyEnabled) {
      this.messageHistory.set(channelId, []);
    }

    return channel;
  }

  /**
   * Get or create a channel
   */
  getOrCreateChannel(id: ChannelId, defaults?: Partial<Channel>): Channel {
    let channel = this.store.get(id);
    if (!channel) {
      channel = this.createChannel({
        id,
        name: defaults?.name ?? id,
        type: defaults?.type,
        config: defaults?.config,
        public: defaults?.public,
        historyEnabled: defaults?.historyEnabled,
      });
    }
    return channel;
  }

  /**
   * Subscribe a connection to a channel
   */
  subscribe(
    connection: Connection,
    channelId: ChannelId,
    fromHistory?: number
  ): SubscribeResult {
    const channel = this.store.get(channelId);
    if (!channel) {
      throw new RealtimeError(
        RealtimeErrorCode.CHANNEL_NOT_FOUND,
        `Channel ${channelId} not found`
      );
    }

    // Check if connection can subscribe
    if (connection.subscribedChannels.length >= this.maxSubscriptionsPerConnection) {
      throw new RealtimeError(
        RealtimeErrorCode.MAX_SUBSCRIPTIONS,
        `Connection has reached maximum subscriptions`
      );
    }

    // Check authorization
    if (!channel.public && channel.config.requireAuth) {
      if (!connection.userId) {
        throw new RealtimeError(
          RealtimeErrorCode.NOT_AUTHORIZED,
          `Authentication required to subscribe to ${channelId}`
        );
      }
      if (channel.allowedSubscribers && !channel.allowedSubscribers.includes(connection.userId)) {
        throw new RealtimeError(
          RealtimeErrorCode.NOT_AUTHORIZED,
          `User not authorized to subscribe to ${channelId}`
        );
      }
    }

    // Add subscription
    let subscribers = this.subscriptions.get(channelId);
    if (!subscribers) {
      subscribers = new Set();
      this.subscriptions.set(channelId, subscribers);
    }
    subscribers.add(connection.id);

    // Update subscriber count
    const updatedChannel: Channel = {
      ...channel,
      subscriberCount: subscribers.size,
    };
    this.store.set(updatedChannel);

    // Get history if requested
    let history: Message[] | undefined;
    if (fromHistory && channel.historyEnabled) {
      const channelHistory = this.messageHistory.get(channelId) ?? [];
      history = channelHistory.slice(-fromHistory);
    }

    return {
      channelId,
      history,
    };
  }

  /**
   * Unsubscribe a connection from a channel
   */
  unsubscribe(connectionId: ConnectionId, channelId: ChannelId): void {
    const subscribers = this.subscriptions.get(channelId);
    if (subscribers) {
      subscribers.delete(connectionId);
      
      const channel = this.store.get(channelId);
      if (channel) {
        const updatedChannel: Channel = {
          ...channel,
          subscriberCount: subscribers.size,
        };
        this.store.set(updatedChannel);
      }
    }
  }

  /**
   * Unsubscribe a connection from all channels
   */
  unsubscribeAll(connectionId: ConnectionId): ChannelId[] {
    const unsubscribedFrom: ChannelId[] = [];

    for (const [channelId, subscribers] of this.subscriptions) {
      if (subscribers.has(connectionId)) {
        subscribers.delete(connectionId);
        unsubscribedFrom.push(channelId);

        const channel = this.store.get(channelId);
        if (channel) {
          const updatedChannel: Channel = {
            ...channel,
            subscriberCount: subscribers.size,
          };
          this.store.set(updatedChannel);
        }
      }
    }

    return unsubscribedFrom;
  }

  /**
   * Get subscribers of a channel
   */
  getSubscribers(channelId: ChannelId): ConnectionId[] {
    const subscribers = this.subscriptions.get(channelId);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Check if a connection is subscribed to a channel
   */
  isSubscribed(connectionId: ConnectionId, channelId: ChannelId): boolean {
    const subscribers = this.subscriptions.get(channelId);
    return subscribers?.has(connectionId) ?? false;
  }

  /**
   * Get a channel
   */
  getChannel(channelId: ChannelId): Channel | undefined {
    return this.store.get(channelId);
  }

  /**
   * Delete a channel
   */
  deleteChannel(channelId: ChannelId): boolean {
    this.subscriptions.delete(channelId);
    this.messageHistory.delete(channelId);
    return this.store.delete(channelId);
  }

  /**
   * Add a message to channel history
   */
  addToHistory(channelId: ChannelId, message: Message): void {
    const channel = this.store.get(channelId);
    if (!channel?.historyEnabled) return;

    let history = this.messageHistory.get(channelId);
    if (!history) {
      history = [];
      this.messageHistory.set(channelId, history);
    }

    history.push(message);

    // Trim history if needed
    const maxSize = channel.historySize ?? this.defaultHistorySize;
    if (history.length > maxSize) {
      history.splice(0, history.length - maxSize);
    }
  }

  /**
   * Get channel history
   */
  getHistory(channelId: ChannelId, limit?: number): Message[] {
    const history = this.messageHistory.get(channelId) ?? [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Get all channels
   */
  getAllChannels(): Channel[] {
    return this.store.getAll();
  }

  /**
   * Get channels by type
   */
  getChannelsByType(type: ChannelType): Channel[] {
    return this.store.findByType(type);
  }
}

/**
 * Create a new channel
 */
export function createChannel(params: {
  id?: ChannelId;
  name: string;
  type?: ChannelType;
  config?: Partial<ChannelConfig>;
  public?: boolean;
}): Channel {
  return {
    id: params.id ?? params.name,
    name: params.name,
    type: params.type ?? ChannelType.BROADCAST,
    config: { ...DEFAULT_CHANNEL_CONFIG, ...params.config },
    subscriberCount: 0,
    createdAt: new Date(),
    historyEnabled: false,
    public: params.public ?? false,
  };
}

/**
 * Check if a user can publish to a channel
 */
export function canPublish(channel: Channel, userId?: string): boolean {
  if (channel.public && !channel.config.requireAuth) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (!channel.allowedPublishers) {
    return true;
  }
  return channel.allowedPublishers.includes(userId);
}

/**
 * Check if a user can subscribe to a channel
 */
export function canSubscribe(channel: Channel, userId?: string): boolean {
  if (channel.public) {
    return true;
  }
  if (!userId) {
    return !channel.config.requireAuth;
  }
  if (!channel.allowedSubscribers) {
    return true;
  }
  return channel.allowedSubscribers.includes(userId);
}
