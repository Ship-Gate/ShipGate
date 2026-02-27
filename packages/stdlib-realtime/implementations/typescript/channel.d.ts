import type { Channel, ChannelId, ChannelConfig, Connection, ConnectionId, SubscribeResult, Message } from './types.js';
import { ChannelType } from './types.js';
/** Default channel configuration */
export declare const DEFAULT_CHANNEL_CONFIG: ChannelConfig;
/** Channel store interface */
export interface ChannelStore {
    get(id: ChannelId): Channel | undefined;
    set(channel: Channel): void;
    delete(id: ChannelId): boolean;
    getAll(): Channel[];
    findByType(type: ChannelType): Channel[];
}
/** In-memory channel store */
export declare class InMemoryChannelStore implements ChannelStore {
    private channels;
    get(id: ChannelId): Channel | undefined;
    set(channel: Channel): void;
    delete(id: ChannelId): boolean;
    getAll(): Channel[];
    findByType(type: ChannelType): Channel[];
}
/** Channel manager options */
export interface ChannelManagerOptions {
    store?: ChannelStore;
    maxSubscriptionsPerConnection?: number;
    defaultHistorySize?: number;
}
/** Channel manager for pub/sub operations */
export declare class ChannelManager {
    private readonly store;
    private readonly maxSubscriptionsPerConnection;
    private readonly defaultHistorySize;
    private readonly subscriptions;
    private readonly messageHistory;
    constructor(options?: ChannelManagerOptions);
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
    }): Channel;
    /**
     * Get or create a channel
     */
    getOrCreateChannel(id: ChannelId, defaults?: Partial<Channel>): Channel;
    /**
     * Subscribe a connection to a channel
     */
    subscribe(connection: Connection, channelId: ChannelId, fromHistory?: number): SubscribeResult;
    /**
     * Unsubscribe a connection from a channel
     */
    unsubscribe(connectionId: ConnectionId, channelId: ChannelId): void;
    /**
     * Unsubscribe a connection from all channels
     */
    unsubscribeAll(connectionId: ConnectionId): ChannelId[];
    /**
     * Get subscribers of a channel
     */
    getSubscribers(channelId: ChannelId): ConnectionId[];
    /**
     * Check if a connection is subscribed to a channel
     */
    isSubscribed(connectionId: ConnectionId, channelId: ChannelId): boolean;
    /**
     * Get a channel
     */
    getChannel(channelId: ChannelId): Channel | undefined;
    /**
     * Delete a channel
     */
    deleteChannel(channelId: ChannelId): boolean;
    /**
     * Add a message to channel history
     */
    addToHistory(channelId: ChannelId, message: Message): void;
    /**
     * Get channel history
     */
    getHistory(channelId: ChannelId, limit?: number): Message[];
    /**
     * Get all channels
     */
    getAllChannels(): Channel[];
    /**
     * Get channels by type
     */
    getChannelsByType(type: ChannelType): Channel[];
}
/**
 * Create a new channel
 */
export declare function createChannel(params: {
    id?: ChannelId;
    name: string;
    type?: ChannelType;
    config?: Partial<ChannelConfig>;
    public?: boolean;
}): Channel;
/**
 * Check if a user can publish to a channel
 */
export declare function canPublish(channel: Channel, userId?: string): boolean;
/**
 * Check if a user can subscribe to a channel
 */
export declare function canSubscribe(channel: Channel, userId?: string): boolean;
//# sourceMappingURL=channel.d.ts.map