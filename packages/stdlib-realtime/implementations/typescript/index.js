// ============================================================================
// ISL Standard Library - Realtime Module
// @isl-lang/stdlib-realtime
// Real-time communication - WebSockets, SSE, and pub/sub
// ============================================================================
export * from './types.js';
export * from './connection.js';
export * from './channel.js';
export * from './message.js';
export * from './presence.js';
// Re-export managers with namespaced imports
import { ConnectionManager, InMemoryConnectionStore } from './connection.js';
import { ChannelManager, InMemoryChannelStore } from './channel.js';
import { PresenceManager, InMemoryPresenceStore } from './presence.js';
import { MessageQueue, MessageRateLimiter } from './message.js';
/** Combined realtime server manager */
export class RealtimeServer {
    connections;
    channels;
    presence;
    constructor(options) {
        this.connections = new ConnectionManager({
            maxConnectionsPerUser: options?.maxConnectionsPerUser,
            connectionTimeoutMs: options?.connectionTimeoutMs,
        });
        this.channels = new ChannelManager({
            maxSubscriptionsPerConnection: options?.maxSubscriptionsPerConnection,
            defaultHistorySize: options?.defaultHistorySize,
        });
        this.presence = new PresenceManager({
            staleTimeoutMs: options?.staleTimeoutMs,
        });
    }
    /**
     * Handle a new connection
     */
    connect(params) {
        return this.connections.connect(params);
    }
    /**
     * Handle disconnection
     */
    disconnect(connectionId, code, reason) {
        // Remove from all channels
        const connection = this.connections.getConnection(connectionId);
        if (connection) {
            // Leave all presence channels
            this.presence.leaveAll(connectionId);
            // Unsubscribe from all channels
            this.channels.unsubscribeAll(connectionId);
        }
        // Disconnect
        this.connections.disconnect(connectionId, code, reason);
    }
    /**
     * Subscribe a connection to a channel
     */
    subscribe(connectionId, channelId, fromHistory) {
        const connection = this.connections.getConnection(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }
        const result = this.channels.subscribe(connection, channelId, fromHistory);
        this.connections.addSubscription(connectionId, channelId);
        return result;
    }
    /**
     * Unsubscribe a connection from a channel
     */
    unsubscribe(connectionId, channelId) {
        this.channels.unsubscribe(connectionId, channelId);
        this.connections.removeSubscription(connectionId, channelId);
        this.presence.leave(channelId, connectionId);
    }
    /**
     * Get connection count
     */
    getConnectionCount() {
        return this.connections.getConnectionCount();
    }
    /**
     * Get all channels
     */
    getAllChannels() {
        return this.channels.getAllChannels();
    }
    /**
     * Cleanup stale connections
     */
    cleanup() {
        const staleConnections = this.connections.cleanupStaleConnections();
        // Clean up related data for stale connections
        for (const connId of staleConnections) {
            this.presence.leaveAll(connId);
            this.channels.unsubscribeAll(connId);
        }
        return { connections: staleConnections };
    }
}
// Default export
export const StdLibRealtime = {
    ConnectionManager,
    ChannelManager,
    PresenceManager,
    MessageQueue,
    MessageRateLimiter,
    InMemoryConnectionStore,
    InMemoryChannelStore,
    InMemoryPresenceStore,
    RealtimeServer,
};
export default StdLibRealtime;
//# sourceMappingURL=index.js.map