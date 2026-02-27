/**
 * WebSocket Client - Real-time subscriptions for ISL-verified APIs
 */
import type { WSMessage, SubscriptionOptions } from '../types';
import { generateId } from '../utils/helpers';

export interface WebSocketClientConfig {
  url: string;
  authToken?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onError?: (error: Error) => void;
}

type MessageHandler<T = unknown> = (data: T) => void;
type ErrorHandler = (error: Error) => void;

interface Subscription {
  channel: string;
  handler: MessageHandler;
  errorHandler?: ErrorHandler;
}

export class WebSocketClient {
  private config: WebSocketClientConfig;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private pendingSubscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private connectionId: string | null = null;
  private messageQueue: WSMessage[] = [];

  constructor(config: WebSocketClientConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
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
        this.connectionId = generateId();

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPing();
          this.config.onConnect?.();
          
          // Process queued messages
          this.processMessageQueue();
          
          // Resubscribe to channels
          this.resubscribe();
          
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.stopPing();
          this.config.onDisconnect?.(event.reason);
          
          if (this.config.reconnect && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          this.isConnecting = false;
          const error = new Error('WebSocket connection error');
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
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.config.reconnect = false;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connectionId = null;
  }

  /**
   * Subscribe to a channel
   */
  subscribe<T = unknown>(
    channel: string,
    handler: MessageHandler<T>,
    options?: SubscriptionOptions<T, Error>
  ): () => void {
    const subscriptionId = generateId();
    const subscription: Subscription = {
      channel,
      handler: handler as MessageHandler,
      errorHandler: options?.onError,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscriptions.set(subscriptionId, subscription);
      this.sendMessage({
        type: 'subscribe',
        channel,
        id: subscriptionId,
      });
    } else {
      this.pendingSubscriptions.set(subscriptionId, subscription);
      // Auto-connect if not connected
      this.connect().catch(() => {
        // Connection failed - subscription will be attempted on reconnect
      });
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscriptionId, channel);
    };
  }

  /**
   * Unsubscribe from a channel
   */
  private unsubscribe(subscriptionId: string, channel: string): void {
    this.subscriptions.delete(subscriptionId);
    this.pendingSubscriptions.delete(subscriptionId);

    // Only send unsubscribe if no other subscriptions for this channel
    const hasOtherSubscriptions = Array.from(this.subscriptions.values())
      .some(sub => sub.channel === channel);

    if (!hasOtherSubscriptions && this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'unsubscribe',
        channel,
        id: subscriptionId,
      });
    }
  }

  /**
   * Send a message to the server
   */
  send<T>(channel: string, payload: T): void {
    const message: WSMessage<T> = {
      type: 'data',
      channel,
      payload,
      timestamp: Date.now(),
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection ID
   */
  getConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Set auth token (reconnects if needed)
   */
  async setAuthToken(token: string): Promise<void> {
    this.config.authToken = token;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.config.reconnect = true;
      await this.connect();
    }
  }

  // Private methods

  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'data':
          this.handleDataMessage(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        case 'pong':
          // Ping response received
          break;
      }
    } catch {
      // Invalid message format
    }
  }

  private handleDataMessage(message: WSMessage): void {
    const { channel, payload } = message;
    if (!channel) return;

    for (const subscription of this.subscriptions.values()) {
      if (subscription.channel === channel) {
        try {
          subscription.handler(payload);
        } catch (error) {
          subscription.errorHandler?.(error as Error);
        }
      }
    }
  }

  private handleErrorMessage(message: WSMessage): void {
    const { channel, payload } = message;
    const error = new Error((payload as { message?: string })?.message ?? 'Unknown error');

    if (channel) {
      for (const subscription of this.subscriptions.values()) {
        if (subscription.channel === channel) {
          subscription.errorHandler?.(error);
        }
      }
    } else {
      this.config.onError?.(error);
    }
  }

  private sendMessage<T>(message: WSMessage<T>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private resubscribe(): void {
    // Move pending to active
    for (const [id, subscription] of this.pendingSubscriptions) {
      this.subscriptions.set(id, subscription);
      this.sendMessage({
        type: 'subscribe',
        channel: subscription.channel,
        id,
      });
    }
    this.pendingSubscriptions.clear();

    // Resubscribe existing
    for (const [id, subscription] of this.subscriptions) {
      this.sendMessage({
        type: 'subscribe',
        channel: subscription.channel,
        id,
      });
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.sendMessage({ type: 'ping' });
    }, this.config.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private shouldReconnect(): boolean {
    return this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 10);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Reconnection failed - will retry
      });
    }, Math.min(delay, 30000));
  }

  private clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
