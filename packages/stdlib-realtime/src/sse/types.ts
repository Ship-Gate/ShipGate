/**
 * Server-Sent Events types
 * @packageDocumentation
 */

import type { ChannelId, EventEmitter, RealtimeEventMap } from '../types.js';

// ============================================================================
// SSE Event Types
// ============================================================================

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SSEMessage {
  event?: string;
  data: any;
  id?: string;
  retry?: number;
}

// ============================================================================
// Server-side Types
// ============================================================================

export interface SSEServerConfig {
  path?: string;
  headers?: Record<string, string>;
  pingInterval?: number;
  retryInterval?: number;
  keepAlive?: boolean;
  compression?: boolean;
}

export interface SSEConnection {
  readonly id: string;
  readonly remoteAddress: string;
  readonly lastEventId?: string;
  readonly channels: Set<ChannelId>;
  
  send(event: SSEEvent): Promise<void>;
  sendText(data: string): Promise<void>;
  sendJson(data: any): Promise<void>;
  close(): void;
  
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}

export interface SSEConnectionManager {
  add(connection: SSEConnection): void;
  remove(id: string): void;
  get(id: string): SSEConnection | undefined;
  getAll(): SSEConnection[];
  count(): number;
  broadcast(event: SSEEvent, exclude?: string[]): Promise<void[]>;
  broadcastToChannel(channelId: ChannelId, event: SSEEvent): Promise<void[]>;
}

// ============================================================================
// Client-side Types
// ============================================================================

export interface SSEClientConfig {
  url: string;
  lastEventId?: string;
  channels?: ChannelId[];
  headers?: Record<string, string>;
  withCredentials?: boolean;
  reconnectStrategy?: import('../types.js').ReconnectStrategy;
  clock?: import('../types.js').Clock;
}

export interface SSEClient extends EventEmitter {
  readonly url: string;
  readonly readyState: SSEReadyState;
  readonly lastEventId?: string;
  readonly reconnectAttempts: number;
  
  connect(): Promise<void>;
  disconnect(): void;
  close(): void;
  
  // Events
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (event: SSEEvent) => void): void;
  on(event: 'reconnecting', handler: (attempt: number) => void): void;
  on(event: 'reconnected', handler: () => void): void;
}

export enum SSEReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

// ============================================================================
// HTTP Types
// ============================================================================

export interface SSEResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  write(data: string): boolean;
  flushHeaders(): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}

export interface SSERequest {
  headers: Record<string, string>;
  url: string;
  method: string;
  query?: Record<string, string>;
}

// ============================================================================
// Adapters
// ============================================================================

export interface SSEAdapter {
  createServer(config: SSEServerConfig): SSEServerAdapter;
  createClient(config: SSEClientConfig): SSEClientAdapter;
}

export interface SSEServerAdapter {
  handleRequest(req: SSERequest, res: SSEResponse): void;
  on(event: 'connection', handler: (connection: SSEConnection, req: SSERequest) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}

export interface SSEClientAdapter {
  connect(): Promise<void>;
  close(): void;
  
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (event: SSEEvent) => void): void;
}
