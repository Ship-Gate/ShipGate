/**
 * Server-Sent Events server implementation
 * @packageDocumentation
 */

import type { Clock, DefaultClock } from '../types.js';
import type {
  SSEServerConfig,
  SSEConnection,
  SSEConnectionManager,
  SSEServerAdapter,
  SSERequest,
  SSEResponse,
  SSEEvent,
} from './types.js';
import type { ChannelId } from '../types.js';
import { SSEError } from '../errors.js';

// ============================================================================
// SSE Connection Implementation
// ============================================================================

class SSEConnectionImpl implements SSEConnection {
  private readonly eventHandlers = new Map<string, Set<Function>>();
  private closed = false;
  private pingTimer?: any;

  constructor(
    public readonly id: string,
    public readonly remoteAddress: string,
    public readonly lastEventId: string | undefined,
    private readonly response: SSEResponse,
    private readonly config: Required<SSEServerConfig>,
    private readonly clock: Clock
  ) {
    this.setupPing();
  }

  get channels(): Set<ChannelId> {
    return new Set(); // Channels managed externally
  }

  async send(event: SSEEvent): Promise<void> {
    if (this.closed) {
      throw new SSEError('CONNECTION_CLOSED', 'SSE connection is closed');
    }

    const lines: string[] = [];

    if (event.id) {
      lines.push(`id: ${event.id}`);
    }

    if (event.event) {
      lines.push(`event: ${event.event}`);
    }

    if (event.retry) {
      lines.push(`retry: ${event.retry}`);
    }

    // Split data by newlines and prefix each line with "data: "
    const dataLines = event.data.split('\n');
    for (const line of dataLines) {
      lines.push(`data: ${line}`);
    }

    // Empty line to end the event
    lines.push('', '');

    const payload = lines.join('\n');

    try {
      const written = this.response.write(payload);
      if (!written) {
        // Wait for drain event if buffer is full
        await new Promise<void>((resolve, reject) => {
          const timeout = this.clock.setTimeout(() => {
            reject(new SSEError('WRITE_TIMEOUT', 'Write timeout'));
          }, 5000);

          this.response.once?.('drain', () => {
            this.clock.clearTimeout(timeout);
            resolve();
          });
        });
      }
    } catch (error) {
      this.close();
      throw new SSEError('WRITE_FAILED', `Failed to write SSE event: ${error.message}`);
    }
  }

  async sendText(data: string): Promise<void> {
    return this.send({ data });
  }

  async sendJson(data: any): Promise<void> {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return this.send({ data: json });
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.clearPing();
    
    try {
      this.response.end();
    } catch (error) {
      // Ignore errors during close
    }

    this.emit('close');
  }

  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in SSE connection event handler for ${event}:`, error);
        }
      }
    }
  }

  private setupPing(): void {
    if (!this.config.pingInterval || !this.config.keepAlive) {
      return;
    }

    this.pingTimer = this.clock.setInterval(() => {
      if (!this.closed) {
        // Send a comment as a ping
        this.response.write(': ping\n\n');
      }
    }, this.config.pingInterval);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      this.clock.clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}

// ============================================================================
// SSE Connection Manager
// ============================================================================

export class SSEConnectionManagerImpl implements SSEConnectionManager {
  private readonly connections = new Map<string, SSEConnection>();
  private readonly channelSubscriptions = new Map<ChannelId, Set<string>>();

  add(connection: SSEConnection): void {
    this.connections.set(connection.id, connection);

    // Setup cleanup on close
    connection.on('close', () => {
      this.remove(connection.id);
    });
  }

  remove(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      // Remove from all channel subscriptions
      for (const channelId of connection.channels) {
        const subscribers = this.channelSubscriptions.get(channelId);
        if (subscribers) {
          subscribers.delete(id);
          if (subscribers.size === 0) {
            this.channelSubscriptions.delete(channelId);
          }
        }
      }

      this.connections.delete(id);
    }
  }

  get(id: string): SSEConnection | undefined {
    return this.connections.get(id);
  }

  getAll(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  count(): number {
    return this.connections.size;
  }

  async broadcast(event: SSEEvent, exclude?: string[]): Promise<void[]> {
    const promises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      if (!exclude || !exclude.includes(connection.id)) {
        promises.push(
          connection.send(event).catch(error => {
            console.error(`Failed to send broadcast to connection ${connection.id}:`, error);
          })
        );
      }
    }

    return Promise.all(promises);
  }

  async broadcastToChannel(channelId: ChannelId, event: SSEEvent): Promise<void[]> {
    const promises: Promise<void>[] = [];
    const subscribers = this.channelSubscriptions.get(channelId);

    if (subscribers) {
      for (const connectionId of subscribers) {
        const connection = this.connections.get(connectionId);
        if (connection) {
          promises.push(
            connection.send(event).catch(error => {
              console.error(`Failed to send to channel ${channelId} connection ${connectionId}:`, error);
            })
          );
        }
      }
    }

    return Promise.all(promises);
  }

  subscribeToChannel(connectionId: string, channelId: ChannelId): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Add to channel subscriptions
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(connectionId);

    // Add channel to connection
    (connection as any).channels.add(channelId);
  }

  unsubscribeFromChannel(connectionId: string, channelId: ChannelId): void {
    // Remove from channel subscriptions
    const subscribers = this.channelSubscriptions.get(channelId);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channelId);
      }
    }

    // Remove channel from connection
    const connection = this.connections.get(connectionId);
    if (connection) {
      (connection as any).channels.delete(channelId);
    }
  }
}

// ============================================================================
// SSE Server
// ============================================================================

export class SSEServer {
  private connectionCounter = 0;
  private readonly connections: SSEConnectionManager;

  constructor(
    private readonly config: SSEServerConfig = {},
    private readonly adapter: SSEServerAdapter,
    private readonly clock: Clock = DefaultClock
  ) {
    this.connections = new SSEConnectionManagerImpl();
    this.setupAdapterListeners();
  }

  get connectionCount(): number {
    return this.connections.count();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  getConnection(id: string): SSEConnection | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): SSEConnection[] {
    return this.connections.getAll();
  }

  // ============================================================================
  // Broadcasting
  // ============================================================================

  async broadcast(event: SSEEvent, exclude?: string[]): Promise<void[]> {
    return this.connections.broadcast(event, exclude);
  }

  async broadcastToChannel(channelId: ChannelId, event: SSEEvent): Promise<void[]> {
    return this.connections.broadcastToChannel(channelId, event);
  }

  // ============================================================================
  // Channel Management
  // ============================================================================

  subscribeToChannel(connectionId: string, channelId: ChannelId): void {
    (this.connections as SSEConnectionManagerImpl).subscribeToChannel(connectionId, channelId);
  }

  unsubscribeFromChannel(connectionId: string, channelId: ChannelId): void {
    (this.connections as SSEConnectionManagerImpl).unsubscribeFromChannel(connectionId, channelId);
  }

  // ============================================================================
  // HTTP Handler
  // ============================================================================

  handleRequest(req: SSERequest, res: SSEResponse): void {
    this.adapter.handleRequest(req, res);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupAdapterListeners(): void {
    this.adapter.on('connection', (connection, req) => {
      this.connections.add(connection);
    });

    this.adapter.on('error', (error) => {
      console.error('SSE server error:', error);
    });
  }
}

// ============================================================================
// Default SSE Server Adapter (Node.js HTTP)
// ============================================================================

export class DefaultSSEServerAdapter implements SSEServerAdapter {
  private connectionHandlers = new Set<(connection: SSEConnection, req: SSERequest) => void>();
  private errorHandlers = new Set<(error: Error) => void>();

  constructor(private readonly config: Required<SSEServerConfig>) {}

  handleRequest(req: SSERequest, res: SSEResponse): void {
    // Check if it's an SSE request
    if (req.method !== 'GET' || !req.headers.accept?.includes('text/event-stream')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request: SSE endpoint requires Accept: text/event-stream');
      return;
    }

    // Get last event ID
    const lastEventId = req.headers['last-event-id'];

    // Set SSE headers
    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...this.config.headers,
    };

    if (this.config.retryInterval) {
      headers['Retry-After'] = this.config.retryInterval.toString();
    }

    res.writeHead(200, headers);
    res.flushHeaders();

    // Create connection
    const connectionId = this.generateConnectionId();
    const connection = new SSEConnectionImpl(
      connectionId,
      req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      lastEventId,
      res,
      this.config,
      { now: () => new Date(), setTimeout, clearTimeout, setInterval, clearInterval } as Clock
    );

    // Handle response close
    res.on('close', () => {
      connection.close();
    });

    res.on('error', (error) => {
      connection.close();
      this.emit('error', error);
    });

    // Emit connection
    this.emit('connection', connection, req);
  }

  on(event: 'connection', handler: (connection: SSEConnection, req: SSERequest) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: string, handler: Function): void {
    if (event === 'connection') {
      this.connectionHandlers.add(handler as any);
    } else if (event === 'error') {
      this.errorHandlers.add(handler as any);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (event === 'connection') {
      for (const handler of this.connectionHandlers) {
        handler(...args);
      }
    } else if (event === 'error') {
      for (const handler of this.errorHandlers) {
        handler(...args);
      }
    }
  }

  private generateConnectionId(): string {
    return `sse_${++this.connectionCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Server Factory
// ============================================================================

export class SSEServerFactory {
  static create(config: SSEServerConfig = {}): SSEServer {
    const defaultConfig: Required<SSEServerConfig> = {
      path: '/events',
      headers: {},
      pingInterval: 30000,
      retryInterval: 2000,
      keepAlive: true,
      compression: false,
    };

    const mergedConfig = { ...defaultConfig, ...config };
    const adapter = new DefaultSSEServerAdapter(mergedConfig);
    
    return new SSEServer(config, adapter);
  }
}
