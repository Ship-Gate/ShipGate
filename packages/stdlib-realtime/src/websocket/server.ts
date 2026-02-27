/**
 * WebSocket server implementation
 * @packageDocumentation
 */

import type { ConnectionId, Clock, DefaultClock } from '../types.js';
import type {
  WebSocketServerConfig,
  WebSocketServerAdapter,
  WebSocketClientInfo,
  WebSocketAdapter,
} from './types.js';
import { ServerWebSocketConnection, WebSocketConnectionFactory } from './connection.js';
import { ConnectionLimitExceededError, ConnectionRefusedError } from '../errors.js';

// ============================================================================
// WebSocket Server
// ============================================================================

export class WebSocketServer {
  private readonly connections = new Map<ConnectionId, ServerWebSocketConnection>();
  private connectionCounter = 0;
  private _listening = false;

  constructor(
    private readonly config: WebSocketServerConfig = {},
    private readonly adapter: WebSocketServerAdapter,
    private readonly clock: Clock = DefaultClock
  ) {
    this.setupServerListeners();
  }

  get listening(): boolean {
    return this._listening;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  // ============================================================================
  // Server Control
  // ============================================================================

  async listen(port?: number, host?: string): Promise<void> {
    if (this._listening) {
      return;
    }

    await this.adapter.listen(port || this.config.port, host);
    this._listening = true;
  }

  async close(): Promise<void> {
    if (!this._listening) {
      return;
    }

    // Close all connections
    const closePromises: Promise<void>[] = [];
    for (const connection of this.connections.values()) {
      connection.close(1001, 'Server shutting down');
      closePromises.push(
        new Promise<void>((resolve) => {
          if (connection.state === 3) { // CLOSED
            resolve();
          } else {
            connection.on('close', () => resolve());
          }
        })
      );
    }

    await Promise.all(closePromises);
    this.connections.clear();

    // Close the server
    await this.adapter.close();
    this._listening = false;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  getConnection(id: ConnectionId): ServerWebSocketConnection | undefined {
    return this.connections.get(id);
  }

  getAllConnections(): ServerWebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  broadcast(data: string | ArrayBuffer | Buffer, exclude?: ConnectionId[]): Promise<void[]> {
    const promises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      if (connection.state === 1) { // OPEN
        if (!exclude || !exclude.includes(connection.id)) {
          promises.push(
            connection.send(data).catch(error => {
              console.error(`Failed to broadcast to connection ${connection.id}:`, error);
            })
          );
        }
      }
    }

    return Promise.all(promises);
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private setupServerListeners(): void {
    this.adapter.on('connection', async (adapter, req) => {
      await this.handleConnection(adapter, req);
    });

    this.adapter.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.adapter.on('listening', () => {
      this._listening = true;
    });
  }

  private async handleConnection(adapter: WebSocketConnectionAdapter, req: any): Promise<void> {
    try {
      // Check connection limit
      if (this.config.maxConnections && this.connections.size >= this.config.maxConnections) {
        adapter.close(1013, 'Server overloaded');
        return;
      }

      // Verify client if configured
      if (this.config.verifyClient) {
        const clientInfo: WebSocketClientInfo = {
          origin: req.headers.origin,
          secure: req.secure,
          req,
        };

        const verified = await this.config.verifyClient(clientInfo);
        if (!verified) {
          adapter.close(4001, 'Client verification failed');
          return;
        }
      }

      // Create connection
      const connectionId = this.generateConnectionId();
      const connection = WebSocketConnectionFactory.createServerConnection(
        connectionId,
        adapter,
        {
          maxPayloadSize: 1024 * 1024, // 1MB default
          pingInterval: 30000, // 30 seconds
          pongTimeout: 5000, // 5 seconds
        },
        this.clock
      );

      // Add to connections map
      this.connections.set(connectionId, connection);

      // Setup connection cleanup
      connection.on('close', () => {
        this.connections.delete(connectionId);
      });

      connection.on('error', (error) => {
        console.error(`Connection ${connectionId} error:`, error);
        this.connections.delete(connectionId);
      });

    } catch (error) {
      console.error('Error handling new connection:', error);
      adapter.close(1011, 'Internal server error');
    }
  }

  private generateConnectionId(): ConnectionId {
    return `ws_${++this.connectionCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// No-op Adapter (for testing/mock scenarios)
// ============================================================================

export class NoOpWebSocketServerAdapter implements WebSocketServerAdapter {
  async listen(): Promise<void> {
    // No-op
  }

  async close(): Promise<void> {
    // No-op
  }

  on(): void {
    // No-op
  }
}

export class NoOpWebSocketConnectionAdapter implements WebSocketConnectionAdapter {
  state = 1; // OPEN
  remoteAddress = '127.0.0.1';

  async send(): Promise<void> {
    // No-op
  }

  close(): void {
    // No-op
  }

  ping(): void {
    // No-op
  }

  pong(): void {
    // No-op
  }

  on(): void {
    // No-op
  }
}

// ============================================================================
// Server Factory
// ============================================================================

export class WebSocketServerFactory {
  static create(
    config: WebSocketServerConfig = {},
    adapter?: WebSocketAdapter
  ): WebSocketServer {
    if (!adapter) {
      // Use no-op adapter if none provided
      console.warn('No WebSocket adapter provided, using no-op adapter');
      return new WebSocketServer(config, new NoOpWebSocketServerAdapter());
    }

    const serverAdapter = adapter.createServer(config);
    return new WebSocketServer(config, serverAdapter);
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DefaultWebSocketServerConfig: Partial<WebSocketServerConfig> = {
  port: 8080,
  host: '0.0.0.0',
  path: '/ws',
  maxConnections: 10000,
  perMessageDeflate: true,
};
