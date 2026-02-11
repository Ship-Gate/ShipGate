/**
 * Presence system types
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  UserId,
  PresenceStatus,
  Clock,
} from '../types.js';

// ============================================================================
// Presence Types
// ============================================================================

export interface Presence {
  channelId: ChannelId;
  userId: UserId;
  connectionId: ConnectionId;
  status: PresenceStatus;
  customState?: Record<string, any>;
  joinedAt: Date;
  lastSeenAt: Date;
  deviceInfo?: {
    type?: string;
    name?: string;
    os?: string;
    browser?: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  metadata?: Record<string, any>;
}

export interface PresenceUpdate {
  userId: UserId;
  connectionId: ConnectionId;
  status?: PresenceStatus;
  customState?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PresenceQuery {
  channelId?: ChannelId;
  userIds?: UserId[];
  connectionIds?: ConnectionId[];
  status?: PresenceStatus;
  onlineOnly?: boolean;
  includeOffline?: boolean;
  customState?: Record<string, any>;
}

export interface PresenceEvent {
  type: 'join' | 'leave' | 'update' | 'timeout';
  channelId: ChannelId;
  userId: UserId;
  connectionId: ConnectionId;
  presence?: Presence;
  timestamp: Date;
}

export interface PresenceDiff {
  joined: Presence[];
  left: Presence[];
  updated: Presence[];
  timestamp: Date;
}

// ============================================================================
// Presence Store Interface
// ============================================================================

export interface PresenceStore {
  // Basic operations
  get(channelId: ChannelId, userId: UserId): Promise<Presence | undefined>;
  getByConnection(connectionId: ConnectionId): Promise<Presence | undefined>;
  add(presence: Presence): Promise<void>;
  update(channelId: ChannelId, userId: UserId, updates: Partial<Presence>): Promise<boolean>;
  remove(channelId: ChannelId, userId: UserId, connectionId?: ConnectionId): Promise<boolean>;
  
  // Query operations
  query(query: PresenceQuery): Promise<Presence[]>;
  getChannelPresences(channelId: ChannelId, options?: { includeOffline?: boolean }): Promise<Presence[]>;
  getUserPresences(userId: UserId): Promise<Presence[]>;
  getConnectionPresences(connectionId: ConnectionId): Promise<Presence[]>;
  
  // Count operations
  count(channelId: ChannelId, options?: { status?: PresenceStatus }): Promise<number>;
  countTotal(): Promise<number>;
  
  // Cleanup
  removeExpired(before: Date): Promise<number>;
  clear(): Promise<void>;
}

// ============================================================================
// Presence Tracker Interface
// ============================================================================

export interface PresenceTracker {
  // Join/Leave operations
  join(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    options?: {
      status?: PresenceStatus;
      customState?: Record<string, any>;
      deviceInfo?: Presence['deviceInfo'];
      metadata?: Record<string, any>;
    }
  ): Promise<Presence>;
  
  leave(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    reason?: string
  ): Promise<boolean>;
  
  leaveAll(connectionId: ConnectionId, reason?: string): Promise<number>;
  
  // Update operations
  update(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    updates: PresenceUpdate
  ): Promise<Presence | undefined>;
  
  updateStatus(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    status: PresenceStatus
  ): Promise<Presence | undefined>;
  
  updateCustomState(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    customState: Record<string, any>
  ): Promise<Presence | undefined>;
  
  // Heartbeat
  heartbeat(channelId: ChannelId, userId: UserId, connectionId: ConnectionId): Promise<void>;
  
  // Query operations
  get(channelId: ChannelId, userId: UserId): Promise<Presence | undefined>;
  getByConnection(connectionId: ConnectionId): Promise<Presence | undefined>;
  list(channelId: ChannelId, options?: PresenceQuery): Promise<Presence[]>;
  
  // Statistics
  getStats(channelId: ChannelId): Promise<PresenceStats>;
  getAllStats(): Promise<Record<ChannelId, PresenceStats>>;
}

// ============================================================================
// Presence State Management
// ============================================================================

export interface PresenceState {
  channelId: ChannelId;
  users: Map<UserId, UserPresenceState>;
  connections: Map<ConnectionId, ConnectionPresenceState>;
  lastUpdated: Date;
}

export interface UserPresenceState {
  userId: UserId;
  connections: Map<ConnectionId, Presence>;
  globalStatus: PresenceStatus;
  lastSeen: Date;
}

export interface ConnectionPresenceState {
  connectionId: ConnectionId;
  userId: UserId;
  channels: Set<ChannelId>;
  lastHeartbeat: Date;
}

export interface PresenceStateManager {
  // State operations
  getState(channelId: ChannelId): Promise<PresenceState | undefined>;
  setState(channelId: ChannelId, state: PresenceState): Promise<void>;
  
  // Diff operations
  getDiff(channelId: ChannelId, since: Date): Promise<PresenceDiff>;
  applyDiff(channelId: ChannelId, diff: PresenceDiff): Promise<void>;
  
  // Snapshot operations
  createSnapshot(channelId: ChannelId): Promise<PresenceState>;
  restoreSnapshot(channelId: ChannelId, snapshot: PresenceState): Promise<void>;
  
  // Cleanup
  cleanup(channelId: ChannelId, olderThan: Date): Promise<void>;
}

// ============================================================================
// Presence Statistics
// ============================================================================

export interface PresenceStats {
  channelId: ChannelId;
  totalUsers: number;
  onlineUsers: number;
  awayUsers: number;
  busyUsers: number;
  invisibleUsers: number;
  totalConnections: number;
  joinRate: number; // joins per minute
  leaveRate: number; // leaves per minute
  averageSessionDuration: number; // in seconds
  topDevices: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  topLocations: Array<{
    country: string;
    count: number;
    percentage: number;
  }>;
}

export interface PresenceMetrics {
  totalChannels: number;
  totalUsers: number;
  totalConnections: number;
  globalStats: PresenceStats;
  channelStats: Record<ChannelId, PresenceStats>;
}

// ============================================================================
// Presence Events
// ============================================================================

export interface PresenceEventMap {
  'presence:joined': { presence: Presence };
  'presence:left': { channelId: ChannelId; userId: UserId; connectionId: ConnectionId; reason?: string };
  'presence:updated': { presence: Presence; changes: string[] };
  'presence:timeout': { presence: Presence };
  'presence:cleaned': { count: number; channelIds: ChannelId[] };
}

export type PresenceEventType = keyof PresenceEventMap;

export interface PresenceEventHandler<T extends PresenceEventType> {
  (data: PresenceEventMap[T]): void | Promise<void>;
}

export interface PresenceEventEmitter {
  on<T extends PresenceEventType>(event: T, handler: PresenceEventHandler<T>): void;
  off<T extends PresenceEventType>(event: T, handler: PresenceEventHandler<T>): void;
  emit<T extends PresenceEventType>(event: T, data: PresenceEventMap[T]): void;
}

// ============================================================================
// Presence Configuration
// ============================================================================

export interface PresenceConfig {
  // Timeout settings
  heartbeatInterval?: number; // in milliseconds
  timeoutThreshold?: number; // in milliseconds
  cleanupInterval?: number; // in milliseconds
  
  // State settings
  maxHistorySize?: number;
  historyRetention?: number; // in milliseconds
  
  // Performance settings
  batchSize?: number;
  compressionEnabled?: boolean;
  
  // Feature flags
  locationTracking?: boolean;
  deviceTracking?: boolean;
  customStateEnabled?: boolean;
  metricsEnabled?: boolean;
}

// ============================================================================
// Presence Synchronization
// ============================================================================

export interface PresenceSyncMessage {
  type: 'join' | 'leave' | 'update' | 'sync';
  channelId: ChannelId;
  presence?: Presence;
  presences?: Presence[];
  timestamp: Date;
  source: string;
}

export interface PresenceSyncProvider {
  publish(message: PresenceSyncMessage): Promise<void>;
  subscribe(channelId: ChannelId, handler: (message: PresenceSyncMessage) => void): Promise<void>;
  unsubscribe(channelId: ChannelId): Promise<void>;
}

export interface PresenceSynchronizer {
  // Sync operations
  syncJoin(presence: Presence): Promise<void>;
  syncLeave(channelId: ChannelId, userId: UserId, connectionId: ConnectionId): Promise<void>;
  syncUpdate(presence: Presence): Promise<void>;
  
  // Batch operations
  syncBatch(messages: PresenceSyncMessage[]): Promise<void>;
  
  // Conflict resolution
  resolveConflict(local: Presence, remote: Presence): Presence;
}
