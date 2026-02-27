// ============================================================================
// Connection Management
// @isl-lang/stdlib-realtime
// ============================================================================

import type {
  Connection,
  ConnectionId,
  ClientId,
  ConnectResult,
} from './types.js';
import {
  Protocol,
  Transport,
  ConnectionStatus,
  RealtimeError,
  RealtimeErrorCode,
} from './types.js';

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
export class InMemoryConnectionStore implements ConnectionStore {
  private connections = new Map<ConnectionId, Connection>();
  private clientIndex = new Map<ClientId, ConnectionId>();
  private userIndex = new Map<string, Set<ConnectionId>>();

  get(id: ConnectionId): Connection | undefined {
    return this.connections.get(id);
  }

  set(connection: Connection): void {
    this.connections.set(connection.id, connection);
    this.clientIndex.set(connection.clientId, connection.id);
    
    if (connection.userId) {
      const userConnections = this.userIndex.get(connection.userId) ?? new Set();
      userConnections.add(connection.id);
      this.userIndex.set(connection.userId, userConnections);
    }
  }

  delete(id: ConnectionId): boolean {
    const connection = this.connections.get(id);
    if (!connection) return false;
    
    this.clientIndex.delete(connection.clientId);
    
    if (connection.userId) {
      const userConnections = this.userIndex.get(connection.userId);
      if (userConnections) {
        userConnections.delete(id);
        if (userConnections.size === 0) {
          this.userIndex.delete(connection.userId);
        }
      }
    }
    
    return this.connections.delete(id);
  }

  getByClientId(clientId: ClientId): Connection | undefined {
    const connectionId = this.clientIndex.get(clientId);
    return connectionId ? this.connections.get(connectionId) : undefined;
  }

  getByUserId(userId: string): Connection[] {
    const connectionIds = this.userIndex.get(userId);
    if (!connectionIds) return [];
    
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is Connection => conn !== undefined);
  }

  getAll(): Connection[] {
    return Array.from(this.connections.values());
  }

  count(): number {
    return this.connections.size;
  }
}

/** Connection manager options */
export interface ConnectionManagerOptions {
  maxConnectionsPerUser?: number;
  connectionTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  store?: ConnectionStore;
}

/** Connection manager for handling realtime connections */
export class ConnectionManager {
  private readonly store: ConnectionStore;
  private readonly maxConnectionsPerUser: number;
  private readonly connectionTimeoutMs: number;

  constructor(options: ConnectionManagerOptions = {}) {
    this.store = options.store ?? new InMemoryConnectionStore();
    this.maxConnectionsPerUser = options.maxConnectionsPerUser ?? 10;
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 30000;
  }

  /**
   * Create a new connection
   */
  connect(params: {
    protocol?: Protocol;
    authToken?: string;
    metadata?: Record<string, string>;
    userAgent?: string;
    ipAddress?: string;
  }): ConnectResult {
    const connectionId = globalThis.crypto.randomUUID();
    const clientId = globalThis.crypto.randomUUID();
    const now = new Date();
    const protocol = params.protocol ?? Protocol.WEBSOCKET;

    const connection: Connection = {
      id: connectionId,
      clientId,
      protocol,
      transport: protocol === Protocol.WEBSOCKET ? Transport.TLS : Transport.HTTP2,
      status: ConnectionStatus.CONNECTED,
      connectedAt: now,
      lastActivityAt: now,
      authToken: params.authToken,
      subscribedChannels: [],
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      metadata: params.metadata,
    };

    this.store.set(connection);

    return {
      connectionId,
      clientId,
      protocol,
    };
  }

  /**
   * Authenticate a connection
   */
  authenticate(connectionId: ConnectionId, userId: string, permissions?: string[]): void {
    const connection = this.store.get(connectionId);
    if (!connection) {
      throw new RealtimeError(
        RealtimeErrorCode.CONNECTION_NOT_FOUND,
        `Connection ${connectionId} not found`
      );
    }

    // Check max connections per user
    const existingConnections = this.store.getByUserId(userId);
    if (existingConnections.length >= this.maxConnectionsPerUser) {
      throw new RealtimeError(
        RealtimeErrorCode.RATE_LIMITED,
        `User ${userId} has reached maximum connections`,
        { maxConnections: this.maxConnectionsPerUser }
      );
    }

    const updatedConnection: Connection = {
      ...connection,
      status: ConnectionStatus.AUTHENTICATED,
      userId,
      permissions,
      lastActivityAt: new Date(),
    };

    this.store.set(updatedConnection);
  }

  /**
   * Disconnect a connection
   */
  disconnect(connectionId: ConnectionId, _code?: number, _reason?: string): void {
    const connection = this.store.get(connectionId);
    if (!connection) return;

    // Mark as disconnecting
    const updatedConnection: Connection = {
      ...connection,
      status: ConnectionStatus.DISCONNECTING,
    };
    this.store.set(updatedConnection);

    // Remove from store
    this.store.delete(connectionId);
  }

  /**
   * Get a connection by ID
   */
  getConnection(connectionId: ConnectionId): Connection | undefined {
    return this.store.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): Connection[] {
    return this.store.getByUserId(userId);
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(connectionId: ConnectionId): void {
    const connection = this.store.get(connectionId);
    if (connection) {
      const updated: Connection = {
        ...connection,
        lastActivityAt: new Date(),
      };
      this.store.set(updated);
    }
  }

  /**
   * Record a ping from client
   */
  recordPing(connectionId: ConnectionId): void {
    const connection = this.store.get(connectionId);
    if (connection) {
      const updated: Connection = {
        ...connection,
        lastPingAt: new Date(),
        lastActivityAt: new Date(),
      };
      this.store.set(updated);
    }
  }

  /**
   * Record a pong response from client
   */
  recordPong(connectionId: ConnectionId): void {
    const connection = this.store.get(connectionId);
    if (connection) {
      const updated: Connection = {
        ...connection,
        lastPongAt: new Date(),
        lastActivityAt: new Date(),
      };
      this.store.set(updated);
    }
  }

  /**
   * Add a channel subscription to a connection
   */
  addSubscription(connectionId: ConnectionId, channelId: string): void {
    const connection = this.store.get(connectionId);
    if (!connection) {
      throw new RealtimeError(
        RealtimeErrorCode.CONNECTION_NOT_FOUND,
        `Connection ${connectionId} not found`
      );
    }

    if (!connection.subscribedChannels.includes(channelId)) {
      const updated: Connection = {
        ...connection,
        subscribedChannels: [...connection.subscribedChannels, channelId],
        lastActivityAt: new Date(),
      };
      this.store.set(updated);
    }
  }

  /**
   * Remove a channel subscription from a connection
   */
  removeSubscription(connectionId: ConnectionId, channelId: string): void {
    const connection = this.store.get(connectionId);
    if (!connection) return;

    const updated: Connection = {
      ...connection,
      subscribedChannels: connection.subscribedChannels.filter(id => id !== channelId),
      lastActivityAt: new Date(),
    };
    this.store.set(updated);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Connection[] {
    return this.store.getAll();
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.store.count();
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(): ConnectionId[] {
    const now = Date.now();
    const staleConnections: ConnectionId[] = [];

    for (const connection of this.store.getAll()) {
      const lastActivity = connection.lastActivityAt.getTime();
      if (now - lastActivity > this.connectionTimeoutMs) {
        staleConnections.push(connection.id);
        this.store.delete(connection.id);
      }
    }

    return staleConnections;
  }
}

/**
 * Create a new connection
 */
export function createConnection(params: {
  protocol?: Protocol;
  transport?: Transport;
  userId?: string;
  authToken?: string;
  metadata?: Record<string, string>;
}): Connection {
  const now = new Date();
  return {
    id: globalThis.crypto.randomUUID(),
    clientId: globalThis.crypto.randomUUID(),
    protocol: params.protocol ?? Protocol.WEBSOCKET,
    transport: params.transport ?? Transport.TLS,
    status: params.authToken ? ConnectionStatus.AUTHENTICATED : ConnectionStatus.CONNECTED,
    connectedAt: now,
    lastActivityAt: now,
    userId: params.userId,
    authToken: params.authToken,
    subscribedChannels: [],
    metadata: params.metadata,
  };
}

/**
 * Check if a connection is active
 */
export function isConnectionActive(connection: Connection): boolean {
  return connection.status === ConnectionStatus.CONNECTED ||
         connection.status === ConnectionStatus.AUTHENTICATED;
}

/**
 * Check if a connection is authenticated
 */
export function isConnectionAuthenticated(connection: Connection): boolean {
  return connection.status === ConnectionStatus.AUTHENTICATED && 
         connection.userId !== undefined;
}
