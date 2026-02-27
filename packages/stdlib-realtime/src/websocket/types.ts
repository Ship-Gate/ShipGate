/**
 * WebSocket types
 * @packageDocumentation
 */

import type { ConnectionId, EventEmitter, RealtimeEventMap } from '../types.js';

// ============================================================================
// WebSocket Connection States
// ============================================================================

export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface WebSocketMessage {
  type: string;
  data: any;
  id?: string;
  timestamp?: number;
}

export interface WebSocketOptions {
  protocols?: string | string[];
  extensions?: any[];
  headers?: Record<string, string>;
  maxPayloadSize?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

// ============================================================================
// Server-side Types
// ============================================================================

export interface WebSocketServerConfig {
  port?: number;
  host?: string;
  path?: string;
  maxConnections?: number;
  perMessageDeflate?: boolean;
  verifyClient?: (info: WebSocketClientInfo) => boolean | Promise<boolean>;
}

export interface WebSocketClientInfo {
  origin: string;
  secure: boolean;
  req: any; // HTTP request object
}

export interface WebSocketConnection {
  readonly id: ConnectionId;
  readonly state: WebSocketState;
  readonly remoteAddress: string;
  readonly userAgent?: string;
  
  send(data: string | ArrayBuffer | Buffer): Promise<void>;
  close(code?: number, reason?: string): void;
  ping(): void;
  pong(): void;
  
  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'ping', handler: (data?: any) => void): void;
  on(event: 'pong', handler: (data?: any) => void): void;
  
  off(event: string, handler: Function): void;
}

// ============================================================================
// Client-side Types
// ============================================================================

export interface WebSocketClientConfig {
  url: string;
  protocols?: string | string[];
  headers?: Record<string, string>;
  reconnectStrategy?: import('../types.js').ReconnectStrategy;
  clock?: import('../types.js').Clock;
  pingInterval?: number;
  pongTimeout?: number;
  maxReconnectDelay?: number;
}

export interface WebSocketClient extends EventEmitter {
  readonly url: string;
  readonly state: WebSocketState;
  readonly connected: boolean;
  readonly reconnectAttempts: number;
  
  connect(): Promise<void>;
  disconnect(code?: number, reason?: string): void;
  send(data: string | ArrayBuffer | Buffer): Promise<void>;
  ping(): void;
  
  // Events
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'reconnecting', handler: (attempt: number) => void): void;
  on(event: 'reconnected', handler: () => void): void;
}

// ============================================================================
// Adapters for different WebSocket implementations
// ============================================================================

export interface WebSocketAdapter {
  createServer(config: WebSocketServerConfig): WebSocketServerAdapter;
  createClient(config: WebSocketClientConfig): WebSocketClientAdapter;
}

export interface WebSocketServerAdapter {
  listen(port?: number, host?: string): Promise<void>;
  close(): Promise<void>;
  
  on(event: 'connection', handler: (connection: WebSocketConnectionAdapter, req: any) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'listening', handler: () => void): void;
}

export interface WebSocketConnectionAdapter {
  readonly state: WebSocketState;
  readonly remoteAddress: string;
  
  send(data: string | ArrayBuffer | Buffer): Promise<void>;
  close(code?: number, reason?: string): void;
  ping(): void;
  pong(): void;
  
  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'ping', handler: (data?: any) => void): void;
  on(event: 'pong', handler: (data?: any) => void): void;
}

export interface WebSocketClientAdapter {
  readonly state: WebSocketState;
  
  connect(): Promise<void>;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBuffer | Buffer): Promise<void>;
  
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (code?: number, reason?: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'message', handler: (data: any) => void): void;
}
