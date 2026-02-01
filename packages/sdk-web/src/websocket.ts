/**
 * WebSocket Client for real-time subscriptions
 */
import type { WebSocketMessage, SubscriptionOptions } from './types';

export interface WebSocketClientConfig {
  url: string;
  authToken?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

type MessageHandler<T> = (data: T) => void;

export class ISLWebSocketClient {
  private config: WebSocketClientConfig;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<MessageHandler<unknown>>> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private pingInterval?: ReturnType<typeof setInterval>;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.config.url);
        if (this.config.authToken) {
          url.searchParams.set('token', this.config.authToken);
        }

        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPing();
          this.resubscribe();
          this.config.onConnect?.();
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.stopPing();
          this.config.onDisconnect?.();

          if (this.config.reconnect && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          this.isConnecting = false;
          const error = new Error('WebSocket error');
          this.config.onError?.(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.config.reconnect = false;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe<T>(
    channel: string,
    handler: MessageHandler<T>,
    options?: SubscriptionOptions<T>
  ): () => void {
    // Store handler
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(handler as MessageHandler<unknown>);

    // Send subscribe message if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', channel });
    } else {
      // Auto-connect if not connected
      this.connect().catch(() => {});
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler as MessageHandler<unknown>);
        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'unsubscribe', channel });
          }
        }
      }
    };
  }

  /**
   * Publish message to channel
   */
  publish<T>(channel: string, data: T): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'message', channel, data });
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string): void {
    this.config.authToken = token;
    // Reconnect with new token
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.config.reconnect = true;
      this.connect().catch(() => {});
    }
  }

  // Private methods

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'message':
          if (message.channel) {
            const handlers = this.subscriptions.get(message.channel);
            if (handlers) {
              handlers.forEach(handler => handler(message.data));
            }
          }
          break;

        case 'error':
          this.config.onError?.(new Error(message.data as string));
          break;

        case 'pong':
          // Ping response received
          break;
      }
    } catch {
      // Invalid message
    }
  }

  private send<T>(message: WebSocketMessage<T>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private resubscribe(): void {
    for (const channel of this.subscriptions.keys()) {
      this.send({ type: 'subscribe', channel });
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private shouldReconnect(): boolean {
    return this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 10);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect().catch(() => {});
    }, Math.min(delay, 30000));
  }

  private clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }
}
