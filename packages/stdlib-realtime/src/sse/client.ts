/**
 * Server-Sent Events client implementation
 * @packageDocumentation
 */

import type { 
  Clock, 
  DefaultClock, 
  EventEmitter, 
  RealtimeEventMap,
  ReconnectStrategy 
} from '../types.js';
import type {
  SSEClientConfig,
  SSEClientAdapter,
  SSEEvent,
  SSEReadyState,
} from './types.js';
import { ExponentialBackoff } from '../types.js';
import { SSEError } from '../errors.js';

// ============================================================================
// SSE Client Implementation
// ============================================================================

export class SSEClient implements EventEmitter {
  private eventSource?: EventSource;
  private reconnectTimer?: any;
  private _reconnectAttempts = 0;
  private _readyState = SSEReadyState.CLOSED;
  private readonly eventEmitter = new Map<string, Set<Function>>();
  private _lastEventId?: string;

  constructor(
    private readonly config: SSEClientConfig,
    private readonly clock: Clock = DefaultClock
  ) {
    this.config.reconnectStrategy = this.config.reconnectStrategy || new ExponentialBackoff();
  }

  get url(): string {
    return this.config.url;
  }

  get readyState(): SSEReadyState {
    return this.eventSource ? this.eventSource.readyState as SSEReadyState : this._readyState;
  }

  get lastEventId(): string | undefined {
    return this._lastEventId || this.config.lastEventId;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this.readyState === SSEReadyState.CONNECTING) {
      return;
    }

    if (this.readyState === SSEReadyState.OPEN) {
      return;
    }

    try {
      this._readyState = SSEReadyState.CONNECTING;
      this.emit('connecting');

      // Build URL with parameters
      const url = this.buildUrl();

      // Create EventSource
      this.eventSource = new EventSource(url, {
        withCredentials: this.config.withCredentials,
      });

      this.setupEventSourceListeners();

      // Wait for connection or error
      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          cleanup();
          resolve();
        };

        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };

        const cleanup = () => {
          this.eventSource?.removeEventListener('open', onOpen);
          this.eventSource?.removeEventListener('error', onError);
        };

        this.eventSource!.addEventListener('open', onOpen);
        this.eventSource!.addEventListener('error', onError);
      });

      this._readyState = SSEReadyState.OPEN;
      this._reconnectAttempts = 0;
      this.emit('open');
      this.emit('reconnected');

    } catch (error) {
      this._readyState = SSEReadyState.CLOSED;
      this.emit('error', error);
      
      if (this.shouldReconnect()) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    this._readyState = SSEReadyState.CLOSED;
    this.emit('close');
  }

  close(): void {
    this.disconnect();
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  on<T extends keyof RealtimeEventMap>(event: T, handler: (data: RealtimeEventMap[T]) => void): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (event: SSEEvent) => void): void;
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
          console.error(`Error in SSE client event handler for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildUrl(): string {
    const url = new URL(this.config.url);
    const params = new URLSearchParams();

    // Add last event ID
    if (this.lastEventId) {
      params.set('lastEventId', this.lastEventId);
    }

    // Add channels
    if (this.config.channels && this.config.channels.length > 0) {
      params.set('channels', this.config.channels.join(','));
    }

    // Add custom parameters
    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        if (key.startsWith('x-')) {
          params.set(key.substring(2), value);
        }
      }
    }

    // Update URL
    const search = params.toString();
    if (search) {
      url.search = url.search ? `${url.search}&${search}` : search;
    }

    return url.toString();
  }

  private setupEventSourceListeners(): void {
    if (!this.eventSource) return;

    this.eventSource.addEventListener('open', () => {
      this._readyState = SSEReadyState.OPEN;
    });

    this.eventSource.addEventListener('error', (event) => {
      this._readyState = SSEReadyState.CLOSED;
      this.eventSource = undefined;
      
      // Check if it's a real error or just a disconnect
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.emit('error', new SSEError('CONNECTION_ERROR', 'SSE connection error'));
        this.emit('close');

        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        }
      }
    });

    this.eventSource.addEventListener('message', (event: MessageEvent) => {
      this._lastEventId = event.lastEventId;
      
      const sseEvent: SSEEvent = {
        data: event.data,
        id: event.lastEventId,
      };

      this.emit('message', sseEvent);
    });

    // Listen for custom event types
    this.eventSource.addEventListener('custom', (event: any) => {
      this._lastEventId = event.lastEventId;
      
      const sseEvent: SSEEvent = {
        event: event.type,
        data: event.data,
        id: event.lastEventId,
      };

      this.emit('message', sseEvent);
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
}

// ============================================================================
// Polyfill for environments without EventSource
// ============================================================================

export class EventSourcePolyfill implements EventSource {
  readonly readyState: number = 0;
  readonly url: string;
  readonly withCredentials: boolean;
  onopen: ((this: EventSource, ev: Event) => any) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null;
  onerror: ((this: EventSource, ev: Event) => any) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string, eventSourceInitDict?: EventSourceInit) {
    this.url = url;
    this.withCredentials = eventSourceInitDict?.withCredentials || false;
    
    // In a real implementation, this would use fetch or XMLHttpRequest
    // to simulate EventSource behavior
    throw new SSEError('NOT_SUPPORTED', 'EventSource is not supported in this environment');
  }

  close(): void {
    // No-op
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    // No-op
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    // No-op
  }

  dispatchEvent(event: Event): boolean {
    return false;
  }
}

// ============================================================================
// Client Factory
// ============================================================================

export class SSEClientFactory {
  static create(config: SSEClientConfig): SSEClient {
    // Check if EventSource is available
    if (typeof EventSource === 'undefined') {
      console.warn('EventSource not available, using polyfill');
      // In a real implementation, you might want to use a full polyfill
      // that implements EventSource behavior using fetch
    }

    return new SSEClient(config);
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DefaultSSEClientConfig: Partial<SSEClientConfig> = {
  withCredentials: false,
  reconnectStrategy: new ExponentialBackoff(10, 1000, 30000, 2),
};
