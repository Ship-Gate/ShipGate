export * from './types.js';
export * from './connection.js';
export * from './channel.js';
export * from './message.js';
export * from './presence.js';
import { ConnectionManager, InMemoryConnectionStore } from './connection.js';
import { ChannelManager, InMemoryChannelStore } from './channel.js';
import { PresenceManager, InMemoryPresenceStore } from './presence.js';
import { MessageQueue, MessageRateLimiter } from './message.js';
/** Combined realtime server manager */
export declare class RealtimeServer {
    readonly connections: ConnectionManager;
    readonly channels: ChannelManager;
    readonly presence: PresenceManager;
    constructor(options?: {
        maxConnectionsPerUser?: number;
        connectionTimeoutMs?: number;
        maxSubscriptionsPerConnection?: number;
        defaultHistorySize?: number;
        staleTimeoutMs?: number;
    });
    /**
     * Handle a new connection
     */
    connect(params: {
        protocol?: import('./types.js').Protocol;
        authToken?: string;
        metadata?: Record<string, string>;
        userAgent?: string;
        ipAddress?: string;
    }): import("./types.js").ConnectResult;
    /**
     * Handle disconnection
     */
    disconnect(connectionId: string, code?: number, reason?: string): void;
    /**
     * Subscribe a connection to a channel
     */
    subscribe(connectionId: string, channelId: string, fromHistory?: number): import("./types.js").SubscribeResult;
    /**
     * Unsubscribe a connection from a channel
     */
    unsubscribe(connectionId: string, channelId: string): void;
    /**
     * Get connection count
     */
    getConnectionCount(): number;
    /**
     * Get all channels
     */
    getAllChannels(): import("./types.js").Channel[];
    /**
     * Cleanup stale connections
     */
    cleanup(): {
        connections: string[];
    };
}
export declare const StdLibRealtime: {
    ConnectionManager: typeof ConnectionManager;
    ChannelManager: typeof ChannelManager;
    PresenceManager: typeof PresenceManager;
    MessageQueue: typeof MessageQueue;
    MessageRateLimiter: typeof MessageRateLimiter;
    InMemoryConnectionStore: typeof InMemoryConnectionStore;
    InMemoryChannelStore: typeof InMemoryChannelStore;
    InMemoryPresenceStore: typeof InMemoryPresenceStore;
    RealtimeServer: typeof RealtimeServer;
};
export default StdLibRealtime;
//# sourceMappingURL=index.d.ts.map