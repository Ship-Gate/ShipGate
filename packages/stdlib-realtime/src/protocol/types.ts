/**
 * Protocol types for realtime communication
 * @packageDocumentation
 */

import type {
  MessageId,
  MessageType,
  ConnectionId,
  ChannelId,
  Priority,
  Clock,
} from '../types.js';

// ============================================================================
// Protocol Message Types
// ============================================================================

export interface ProtocolMessage {
  id: MessageId;
  type: MessageType;
  timestamp: number;
  version: string;
  checksum?: string;
}

export interface ProtocolHeader {
  id: MessageId;
  type: MessageType;
  timestamp: number;
  version: string;
  priority?: Priority;
  ttl?: number;
  source?: string;
  destination?: string;
  correlationId?: MessageId;
  flags?: number;
  checksum?: string;
  compression?: 'none' | 'gzip' | 'deflate' | 'br';
  encryption?: 'none' | 'aes128' | 'aes256';
}

export interface ProtocolPayload {
  data?: any;
  metadata?: Record<string, any>;
  error?: ProtocolError;
}

export interface ProtocolPacket {
  header: ProtocolHeader;
  payload: ProtocolPayload;
}

// ============================================================================
// Message Types
// ============================================================================

export interface PingMessage extends ProtocolMessage {
  type: MessageType.PING;
  data?: {
    timestamp?: number;
    latency?: number;
  };
}

export interface PongMessage extends ProtocolMessage {
  type: MessageType.PONG;
  data?: {
    originalTimestamp?: number;
    latency?: number;
  };
}

export interface EventMessage extends ProtocolMessage {
  type: MessageType.EVENT;
  event: string;
  channelId: ChannelId;
  data: any;
}

export interface SubscribeMessage extends ProtocolMessage {
  type: MessageType.JSON; // Using JSON for control messages
  action: 'subscribe';
  channelId: ChannelId;
  options?: {
    fromHistory?: number;
    auth?: string;
  };
}

export interface UnsubscribeMessage extends ProtocolMessage {
  type: MessageType.JSON;
  action: 'unsubscribe';
  channelId: ChannelId;
  reason?: string;
}

export interface PublishMessage extends ProtocolMessage {
  type: MessageType.JSON;
  action: 'publish';
  channelId: ChannelId;
  event: string;
  data: any;
  options?: {
    exclude?: ConnectionId[];
    priority?: Priority;
    ttl?: number;
  };
}

export interface PresenceMessage extends ProtocolMessage {
  type: MessageType.JSON;
  action: 'presence';
  operation: 'join' | 'leave' | 'update';
  channelId: ChannelId;
  data?: any;
}

export interface AuthMessage extends ProtocolMessage {
  type: MessageType.JSON;
  action: 'auth';
  token?: string;
  method?: 'token' | 'basic' | 'oauth';
}

export interface ErrorMessage extends ProtocolMessage {
  type: MessageType.JSON;
  error: ProtocolError;
}

// ============================================================================
// Protocol Error Types
// ============================================================================

export interface ProtocolError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export const ProtocolErrorCodes = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_VERSION: 'INVALID_VERSION',
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
  MESSAGE_TOO_LARGE: 'MESSAGE_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  SUBSCRIPTION_FAILED: 'SUBSCRIPTION_FAILED',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ProtocolErrorCode = typeof ProtocolErrorCodes[keyof typeof ProtocolErrorCodes];

// ============================================================================
// Codec Interface
// ============================================================================

export interface ProtocolCodec {
  // Encoding/Decoding
  encode(packet: ProtocolPacket): Promise<Uint8Array>;
  decode(data: Uint8Array): Promise<ProtocolPacket>;
  
  // Validation
  validate(packet: ProtocolPacket): Promise<boolean>;
  validateFormat(data: Uint8Array): Promise<boolean>;
  
  // Configuration
  setCompression(type: 'none' | 'gzip' | 'deflate' | 'br'): void;
  setEncryption(type: 'none' | 'aes128' | 'aes256', key?: Uint8Array): void;
  setChecksum(enabled: boolean): void;
  
  // Statistics
  getStats(): CodecStats;
}

// ============================================================================
// Heartbeat Interface
// ============================================================================

export interface HeartbeatConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  maxMissed: number;
  jitter?: number; // milliseconds
  onTimeout?: (connectionId: ConnectionId) => void;
  onPing?: (connectionId: ConnectionId) => void;
  onPong?: (connectionId: ConnectionId, latency: number) => void;
}

export interface HeartbeatManager {
  // Connection management
  addConnection(connectionId: ConnectionId, config?: Partial<HeartbeatConfig>): void;
  removeConnection(connectionId: ConnectionId): void;
  
  // Control
  start(connectionId?: ConnectionId): void;
  stop(connectionId?: ConnectionId): void;
  
  // Events
  ping(connectionId: ConnectionId): Promise<number>; // Returns latency
  handlePong(connectionId: ConnectionId, data?: any): void;
  
  // Status
  isAlive(connectionId: ConnectionId): boolean;
  getLatency(connectionId: ConnectionId): number | undefined;
  getLastSeen(connectionId: ConnectionId): Date | undefined;
  
  // Cleanup
  cleanup(): void;
}

// ============================================================================
// Protocol Version
// ============================================================================

export interface ProtocolVersion {
  major: number;
  minor: number;
  patch: number;
  pre?: string;
}

export const CURRENT_PROTOCOL_VERSION: ProtocolVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

export const SUPPORTED_PROTOCOL_VERSIONS: ProtocolVersion[] = [
  CURRENT_PROTOCOL_VERSION,
];

// ============================================================================
// Codec Statistics
// ============================================================================

export interface CodecStats {
  messagesEncoded: number;
  messagesDecoded: number;
  bytesEncoded: number;
  bytesDecoded: number;
  errors: number;
  compressionRatio?: number;
  averageEncodeTime: number;
  averageDecodeTime: number;
}

// ============================================================================
// Message Flags
// ============================================================================

export const MessageFlags = {
  NONE: 0,
  COMPRESSED: 1 << 0,
  ENCRYPTED: 1 << 1,
  CHECKSUM: 1 << 2,
  URGENT: 1 << 3,
  NO_ACK: 1 << 4,
  BROADCAST: 1 << 5,
  RETRY: 1 << 6,
} as const;

export type MessageFlag = typeof MessageFlags[keyof typeof MessageFlags];

// ============================================================================
// Protocol Configuration
// ============================================================================

export interface ProtocolConfig {
  version: ProtocolVersion;
  maxMessageSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  enableChecksum: boolean;
  compressionType: 'none' | 'gzip' | 'deflate' | 'br';
  encryptionType: 'none' | 'aes128' | 'aes256';
  encryptionKey?: Uint8Array;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

// ============================================================================
// Transport Interface
// ============================================================================

export interface ProtocolTransport {
  send(packet: ProtocolPacket, destination?: string): Promise<void>;
  receive(): AsyncIterableIterator<ProtocolPacket>;
  close(): Promise<void>;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'close', handler: () => void): void;
}

// ============================================================================
// Protocol Handler Interface
// ============================================================================

export interface ProtocolHandler {
  handleMessage(packet: ProtocolPacket, connectionId: ConnectionId): Promise<void>;
  handleError(error: Error, packet?: ProtocolPacket): Promise<void>;
  canHandle(packet: ProtocolPacket): boolean;
}

// ============================================================================
// Protocol Registry
// ============================================================================

export interface ProtocolRegistry {
  registerHandler(type: MessageType, handler: ProtocolHandler): void;
  unregisterHandler(type: MessageType): void;
  getHandler(type: MessageType): ProtocolHandler | undefined;
  listHandlers(): MessageType[];
}

// ============================================================================
// Flow Control
// ============================================================================

export interface FlowControlWindow {
  size: number;
  current: number;
  threshold: number;
}

export interface FlowControlManager {
  getWindow(connectionId: ConnectionId): FlowControlWindow;
  updateWindow(connectionId: ConnectionId, bytes: number): void;
  resetWindow(connectionId: ConnectionId): void;
  isBlocked(connectionId: ConnectionId): boolean;
  waitAvailable(connectionId: ConnectionId, bytes: number): Promise<void>;
}
