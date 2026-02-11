import type { Connection, ConnectionId, ClientId, ConnectResult } from './types.js';
import { Protocol, Transport } from './types.js';
/** Connection store interface */
export interface ConnectionStore {
    get(id: ConnectionId): Connection | undefined;
    set(connection: Connection): void;
    delete(id: ConnectionId): boolean;
    getByClientId(clientId: ClientId): Connection | undefined;
    getByUserId(userId: string): Connection[];
    getAll(): Connection[];
    count(): number;
}
/** In-memory connection store implementation */
export declare class InMemoryConnectionStore implements ConnectionStore {
    private connections;
    private clientIndex;
    private userIndex;
    get(id: ConnectionId): Connection | undefined;
    set(connection: Connection): void;
    delete(id: ConnectionId): boolean;
    getByClientId(clientId: ClientId): Connection | undefined;
    getByUserId(userId: string): Connection[];
    getAll(): Connection[];
    count(): number;
}
/** Connection manager options */
export interface ConnectionManagerOptions {
    maxConnectionsPerUser?: number;
    connectionTimeoutMs?: number;
    heartbeatIntervalMs?: number;
    store?: ConnectionStore;
}
/** Connection manager for handling realtime connections */
export declare class ConnectionManager {
    private readonly store;
    private readonly maxConnectionsPerUser;
    private readonly connectionTimeoutMs;
    constructor(options?: ConnectionManagerOptions);
    /**
     * Create a new connection
     */
    connect(params: {
        protocol?: Protocol;
        authToken?: string;
        metadata?: Record<string, string>;
        userAgent?: string;
        ipAddress?: string;
    }): ConnectResult;
    /**
     * Authenticate a connection
     */
    authenticate(connectionId: ConnectionId, userId: string, permissions?: string[]): void;
    /**
     * Disconnect a connection
     */
    disconnect(connectionId: ConnectionId, _code?: number, _reason?: string): void;
    /**
     * Get a connection by ID
     */
    getConnection(connectionId: ConnectionId): Connection | undefined;
    /**
     * Get all connections for a user
     */
    getUserConnections(userId: string): Connection[];
    /**
     * Update connection activity timestamp
     */
    updateActivity(connectionId: ConnectionId): void;
    /**
     * Record a ping from client
     */
    recordPing(connectionId: ConnectionId): void;
    /**
     * Record a pong response from client
     */
    recordPong(connectionId: ConnectionId): void;
    /**
     * Add a channel subscription to a connection
     */
    addSubscription(connectionId: ConnectionId, channelId: string): void;
    /**
     * Remove a channel subscription from a connection
     */
    removeSubscription(connectionId: ConnectionId, channelId: string): void;
    /**
     * Get all active connections
     */
    getAllConnections(): Connection[];
    /**
     * Get connection count
     */
    getConnectionCount(): number;
    /**
     * Clean up stale connections
     */
    cleanupStaleConnections(): ConnectionId[];
}
/**
 * Create a new connection
 */
export declare function createConnection(params: {
    protocol?: Protocol;
    transport?: Transport;
    userId?: string;
    authToken?: string;
    metadata?: Record<string, string>;
}): Connection;
/**
 * Check if a connection is active
 */
export declare function isConnectionActive(connection: Connection): boolean;
/**
 * Check if a connection is authenticated
 */
export declare function isConnectionAuthenticated(connection: Connection): boolean;
//# sourceMappingURL=connection.d.ts.map