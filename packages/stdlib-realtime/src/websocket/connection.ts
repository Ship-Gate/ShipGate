/**
 * WebSocket connection management
 * @packageDocumentation
 */

import type { 
  ConnectionId, 
  Clock, 
  DefaultClock,
  EventEmitter,
  RealtimeEventMap 
} from '../types.js';
import type { 
  WebSocketState, 
  WebSocketConnection, 
  WebSocketConnectionAdapter,
  WebSocketOptions 
} from './types.js';
import { ConnectionTimeoutError, ConnectionError } from '../errors.js';

// ============================================================================
// Base WebSocket Connection
// ============================================================================

export class BaseWebSocketConnection implements WebSocketConnection {
  private readonly eventEmitter = new Map<string, Set<Function>>();
  private pingTimer?: any;
  private pongTimer?: any;
  private _state: WebSocketState = WebSocketState.CONNECTING;

  constructor(
    public readonly id: ConnectionId,
    public readonly remoteAddress: string,
    public readonly userAgent?: string,
    private readonly adapter: WebSocketConnectionAdapter,
    private readonly options: WebSocketOptions = {},
    private readonly clock: Clock = DefaultClock
  ) {
    this.setupAdapterListeners();
    this.startHeartbeat();
  }

  get state(): WebSocketState {
    return this._state;
  }

  // ============================================================================
  // Send Methods
  // ============================================================================

  async send(data: string | ArrayBuffer | Buffer): Promise<void> {
    if (this._state !== WebSocketState.OPEN) {
      throw new ConnectionError('INVALID_STATE', 'WebSocket is not open');
    }

    // Check payload size
    const size = this.getDataSize(data);
    if (this.options.maxPayloadSize && size > this.options.maxPayloadSize) {
      throw new ConnectionError('PAYLOAD_TOO_LARGE', `Message size ${size} exceeds maximum ${this.options.maxPayloadSize}`);
    }

    try {
      await this.adapter.send(data);
    } catch (error) {
      throw new ConnectionError('SEND_FAILED', `Failed to send message: ${error.message}`);
    }
  }

  // ============================================================================
  // Connection Control
  // ============================================================================

  close(code?: number, reason?: string): void {
    if (this._state === WebSocketState.CLOSING || this._state === WebSocketState.CLOSED) {
      return;
    }

    this._state = WebSocketState.CLOSING;
    this.stopHeartbeat();
    this.adapter.close(code, reason);
  }

  ping(): void {
    if (this._state === WebSocketState.OPEN) {
      this.adapter.ping();
    }
  }

  pong(): void {
    if (this._state === WebSocketState.OPEN) {
      this.adapter.pong();
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'ping', handler: (data?: any) => void): void;
  on(event: 'pong', handler: (data?: any) => void): void;
  on(event: string, handler: Function): void {
    if (!this.eventEmitter.has(event)) {
      this.eventEmitter.set(event, new Set());
    }
    this.eventEmitter.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventEmitter.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventEmitter.delete(event);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventEmitter.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Heartbeat Management
  // ============================================================================

  private setupAdapterListeners(): void {
    this.adapter.on('message', (data) => {
      this.emit('message', data);
    });

    this.adapter.on('close', (code, reason) => {
      this._state = WebSocketState.CLOSED;
      this.stopHeartbeat();
      this.emit('close', code, reason);
    });

    this.adapter.on('error', (error) => {
      this._state = WebSocketState.CLOSED;
      this.stopHeartbeat();
      this.emit('error', error);
    });

    this.adapter.on('ping', (data) => {
      this.emit('ping', data);
      // Auto-respond to pings
      this.pong();
    });

    this.adapter.on('pong', (data) => {
      this.emit('pong', data);
      this.handlePong();
    });
  }

  private startHeartbeat(): void {
    if (!this.options.pingInterval) return;

    this.pingTimer = this.clock.setInterval(() => {
      if (this._state === WebSocketState.OPEN) {
        this.ping();
        
        // Set pong timeout
        if (this.options.pongTimeout) {
          this.pongTimer = this.clock.setTimeout(() => {
            this.emit('error', new ConnectionTimeoutError(this.id));
            this.close(1000, 'Pong timeout');
          }, this.options.pongTimeout);
        }
      }
    }, this.options.pingInterval);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      this.clock.clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.pongTimer) {
      this.clock.clearTimeout(this.pongTimer);
      this.pongTimer = undefined;
    }
  }

  private handlePong(): void {
    if (this.pongTimer) {
      this.clock.clearTimeout(this.pongTimer);
      this.pongTimer = undefined;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getDataSize(data: string | ArrayBuffer | Buffer): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (Buffer.isBuffer(data)) {
      return data.length;
    }
    return 0;
  }
}

// ============================================================================
// Server WebSocket Connection
// ============================================================================

export class ServerWebSocketConnection extends BaseWebSocketConnection implements EventEmitter {
  constructor(
    id: ConnectionId,
    adapter: WebSocketConnectionAdapter,
    options?: WebSocketOptions,
    clock?: Clock
  ) {
    // Extract connection info from adapter
    super(
      id,
      adapter.remoteAddress,
      undefined, // User agent not available on server
      adapter,
      options,
      clock
    );
  }

  // ============================================================================
  // EventEmitter Implementation
  // ============================================================================

  on<T extends keyof RealtimeEventMap>(event: T, handler: (data: RealtimeEventMap[T]) => void): void {
    super.on(event, handler as any);
  }

  emit<T extends keyof RealtimeEventMap>(event: T, data: RealtimeEventMap[T]): void {
    super.emit(event, data);
  }
}

// ============================================================================
// Connection Factory
// ============================================================================

export class WebSocketConnectionFactory {
  static createServerConnection(
    id: ConnectionId,
    adapter: WebSocketConnectionAdapter,
    options?: WebSocketOptions,
    clock?: Clock
  ): ServerWebSocketConnection {
    return new ServerWebSocketConnection(id, adapter, options, clock);
  }

  static createClientConnection(
    id: ConnectionId,
    remoteAddress: string,
    userAgent: string,
    adapter: WebSocketConnectionAdapter,
    options?: WebSocketOptions,
    clock?: Clock
  ): BaseWebSocketConnection {
    return new BaseWebSocketConnection(id, remoteAddress, userAgent, adapter, options, clock);
  }
}

// ============================================================================
// Connection Pool
// ============================================================================

export class WebSocketConnectionPool {
  private readonly connections = new Map<ConnectionId, BaseWebSocketConnection>();

  add(connection: BaseWebSocketConnection): void {
    this.connections.set(connection.id, connection);
  }

  remove(id: ConnectionId): boolean {
    return this.connections.delete(id);
  }

  get(id: ConnectionId): BaseWebSocketConnection | undefined {
    return this.connections.get(id);
  }

  getAll(): BaseWebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  count(): number {
    return this.connections.size;
  }

  clear(): void {
    for (const connection of this.connections.values()) {
      connection.close(1000, 'Server shutting down');
    }
    this.connections.clear();
  }

  broadcast(data: string | ArrayBuffer | Buffer, exclude?: ConnectionId[]): Promise<void[]> {
    const promises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      if (connection.state === WebSocketState.OPEN) {
        if (!exclude || !exclude.includes(connection.id)) {
          promises.push(
            connection.send(data).catch(error => {
              console.error(`Failed to send to connection ${connection.id}:`, error);
            })
          );
        }
      }
    }

    return Promise.all(promises);
  }
}
