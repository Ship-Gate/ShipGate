/**
 * WebSocket client implementation with auto-reconnect
 * @packageDocumentation
 */

import type { 
  ConnectionId, 
  Clock, 
  DefaultClock, 
  EventEmitter, 
  RealtimeEventMap,
  ReconnectStrategy 
} from '../types.js';
import type { 
  WebSocketClientConfig, 
  WebSocketClientAdapter,
  WebSocketAdapter,
  WebSocketState 
} from './types.js';
import { ExponentialBackoff } from '../types.js';
import { BaseWebSocketConnection, WebSocketConnectionFactory } from './connection.js';
import { ConnectionError, ConnectionTimeoutError } from '../errors.js';

// ============================================================================
// WebSocket Client
// ============================================================================

export class WebSocketClient implements EventEmitter {
  private connection?: BaseWebSocketConnection;
  private reconnectTimer?: any;
  private _reconnectAttempts = 0;
  private _state = WebSocketState.CLOSED;
  private readonly eventEmitter = new Map<string, Set<Function>>();

  constructor(
    private readonly config: WebSocketClientConfig,
    private readonly adapter: WebSocketClientAdapter,
    private readonly clock: Clock = DefaultClock
  ) {
    this.config.reconnectStrategy = this.config.reconnectStrategy || new ExponentialBackoff();
    this.setupAdapterListeners();
  }

  get url(): string {
    return this.config.url;
  }

  get state(): WebSocketState {
    return this.connection ? this.connection.state : this._state;
  }

  get connected(): boolean {
    return this.state === WebSocketState.OPEN;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this.state === WebSocketState.CONNECTING) {
      return;
    }

    if (this.state === WebSocketState.OPEN) {
      return;
    }

    try {
      this._state = WebSocketState.CONNECTING;
      this.emit('connecting');

      await this.adapter.connect();
      this._state = WebSocketState.OPEN;
      this._reconnectAttempts = 0;

      // Create connection wrapper
      this.connection = WebSocketConnectionFactory.createClientConnection(
        this.generateConnectionId(),
        'client', // remote address not available on client
        navigator?.userAgent || 'unknown',
        this.adapter,
        {
          pingInterval: this.config.pingInterval || 30000,
          pongTimeout: this.config.pongTimeout || 5000,
          maxPayloadSize: 1024 * 1024, // 1MB default
        },
        this.clock
      );

      this.setupConnectionListeners();
      this.emit('open');
      this.emit('reconnected');

    } catch (error) {
      this._state = WebSocketState.CLOSED;
      this.emit('error', error);
      
      if (this.shouldReconnect()) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect(code?: number, reason?: string): void {
    this.clearReconnectTimer();
    
    if (this.connection) {
      this.connection.close(code, reason);
    } else {
      this.adapter.close(code, reason);
    }
    
    this._state = WebSocketState.CLOSED;
  }

  // ============================================================================
  // Send Methods
  // ============================================================================

  async send(data: string | ArrayBuffer | Buffer): Promise<void> {
    if (!this.connection || this.state !== WebSocketState.OPEN) {
      throw new ConnectionError('INVALID_STATE', 'WebSocket is not connected');
    }

    return this.connection.send(data);
  }

  ping(): void {
    if (this.connection) {
      this.connection.ping();
    }
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on<T extends keyof RealtimeEventMap>(event: T, handler: (data: RealtimeEventMap[T]) => void): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'reconnecting', handler: (attempt: number) => void): void;
  on(event: 'reconnected', handler: () => void): void;
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

  emit<T extends keyof RealtimeEventMap>(event: T, data: RealtimeEventMap[T]): void;
  emit(event: string, ...args: any[]): void {
    const handlers = this.eventEmitter.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in WebSocket client event handler for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupAdapterListeners(): void {
    this.adapter.on('open', () => {
      this._state = WebSocketState.OPEN;
    });

    this.adapter.on('close', (code, reason) => {
      this._state = WebSocketState.CLOSED;
      this.connection = undefined;
      this.emit('close', code, reason);

      if (this.shouldReconnect()) {
        this.scheduleReconnect();
      }
    });

    this.adapter.on('error', (error) => {
      this.emit('error', error);
    });

    this.adapter.on('message', (data) => {
      this.emit('message', data);
    });
  }

  private setupConnectionListeners(): void {
    if (!this.connection) return;

    this.connection.on('close', (code, reason) => {
      this.connection = undefined;
      this.emit('close', code, reason);

      if (this.shouldReconnect()) {
        this.scheduleReconnect();
      }
    });

    this.connection.on('error', (error) => {
      this.emit('error', error);
    });

    this.connection.on('message', (data) => {
      this.emit('message', data);
    });
  }

  private shouldReconnect(): boolean {
    if (!this.config.reconnectStrategy) {
      return false;
    }

    return this.config.reconnectStrategy.shouldReconnect(
      this._reconnectAttempts + 1
    );
  }

  private scheduleReconnect(): void {
    if (!this.config.reconnectStrategy) {
      return;
    }

    this._reconnectAttempts++;
    const delay = this.config.reconnectStrategy.getDelay(this._reconnectAttempts);

    this.emit('reconnecting', this._reconnectAttempts);

    this.reconnectTimer = this.clock.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      this.clock.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private generateConnectionId(): ConnectionId {
    return `ws_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// No-op Client Adapter (for testing/mock scenarios)
// ============================================================================

export class NoOpWebSocketClientAdapter implements WebSocketClientAdapter {
  state = WebSocketState.CLOSED;

  async connect(): Promise<void> {
    // No-op
  }

  close(): void {
    // No-op
  }

  async send(): Promise<void> {
    // No-op
  }

  on(): void {
    // No-op
  }
}

// ============================================================================
// Client Factory
// ============================================================================

export class WebSocketClientFactory {
  static create(
    config: WebSocketClientConfig,
    adapter?: WebSocketAdapter
  ): WebSocketClient {
    if (!adapter) {
      // Use no-op adapter if none provided
      console.warn('No WebSocket adapter provided, using no-op adapter');
      return new WebSocketClient(config, new NoOpWebSocketClientAdapter());
    }

    const clientAdapter = adapter.createClient(config);
    return new WebSocketClient(config, clientAdapter);
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DefaultWebSocketClientConfig: Partial<WebSocketClientConfig> = {
  pingInterval: 30000, // 30 seconds
  pongTimeout: 5000, // 5 seconds
  reconnectStrategy: new ExponentialBackoff(10, 1000, 30000, 2),
};
