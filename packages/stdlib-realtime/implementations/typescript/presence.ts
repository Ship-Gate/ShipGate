// ============================================================================
// Presence Tracking
// @isl-lang/stdlib-realtime
// ============================================================================

import type {
  Presence,
  ChannelId,
  ConnectionId,
  DeviceInfo,
} from './types.js';
import {
  PresenceStatus,
  RealtimeError,
  RealtimeErrorCode,
} from './types.js';

/** Presence store interface */
export interface PresenceStore {
  get(channelId: ChannelId, connectionId: ConnectionId): Presence | undefined;
  set(presence: Presence): void;
  delete(channelId: ChannelId, connectionId: ConnectionId): boolean;
  getByChannel(channelId: ChannelId): Presence[];
  getByUser(userId: string): Presence[];
  getByConnection(connectionId: ConnectionId): Presence[];
}

/** In-memory presence store */
export class InMemoryPresenceStore implements PresenceStore {
  private presence = new Map<string, Presence>();
  private channelIndex = new Map<ChannelId, Set<string>>();
  private userIndex = new Map<string, Set<string>>();
  private connectionIndex = new Map<ConnectionId, Set<string>>();

  private makeKey(channelId: ChannelId, connectionId: ConnectionId): string {
    return `${channelId}:${connectionId}`;
  }

  get(channelId: ChannelId, connectionId: ConnectionId): Presence | undefined {
    return this.presence.get(this.makeKey(channelId, connectionId));
  }

  set(presence: Presence): void {
    const key = this.makeKey(presence.channelId, presence.connectionId);
    this.presence.set(key, presence);

    // Update channel index
    let channelSet = this.channelIndex.get(presence.channelId);
    if (!channelSet) {
      channelSet = new Set();
      this.channelIndex.set(presence.channelId, channelSet);
    }
    channelSet.add(key);

    // Update user index
    let userSet = this.userIndex.get(presence.userId);
    if (!userSet) {
      userSet = new Set();
      this.userIndex.set(presence.userId, userSet);
    }
    userSet.add(key);

    // Update connection index
    let connSet = this.connectionIndex.get(presence.connectionId);
    if (!connSet) {
      connSet = new Set();
      this.connectionIndex.set(presence.connectionId, connSet);
    }
    connSet.add(key);
  }

  delete(channelId: ChannelId, connectionId: ConnectionId): boolean {
    const key = this.makeKey(channelId, connectionId);
    const presence = this.presence.get(key);
    if (!presence) return false;

    // Clean up indexes
    this.channelIndex.get(channelId)?.delete(key);
    this.userIndex.get(presence.userId)?.delete(key);
    this.connectionIndex.get(connectionId)?.delete(key);

    return this.presence.delete(key);
  }

  getByChannel(channelId: ChannelId): Presence[] {
    const keys = this.channelIndex.get(channelId);
    if (!keys) return [];
    return Array.from(keys)
      .map(k => this.presence.get(k))
      .filter((p): p is Presence => p !== undefined);
  }

  getByUser(userId: string): Presence[] {
    const keys = this.userIndex.get(userId);
    if (!keys) return [];
    return Array.from(keys)
      .map(k => this.presence.get(k))
      .filter((p): p is Presence => p !== undefined);
  }

  getByConnection(connectionId: ConnectionId): Presence[] {
    const keys = this.connectionIndex.get(connectionId);
    if (!keys) return [];
    return Array.from(keys)
      .map(k => this.presence.get(k))
      .filter((p): p is Presence => p !== undefined);
  }
}

/** Presence manager options */
export interface PresenceManagerOptions {
  store?: PresenceStore;
  staleTimeoutMs?: number;
}

/** Presence manager for tracking user presence */
export class PresenceManager {
  private readonly store: PresenceStore;

  constructor(options: PresenceManagerOptions = {}) {
    this.store = options.store ?? new InMemoryPresenceStore();
  }

  /**
   * Join a channel (create presence)
   */
  join(params: {
    channelId: ChannelId;
    connectionId: ConnectionId;
    userId: string;
    status?: PresenceStatus;
    customState?: Record<string, unknown>;
    deviceInfo?: DeviceInfo;
  }): Presence {
    const now = new Date();
    const presence: Presence = {
      channelId: params.channelId,
      userId: params.userId,
      connectionId: params.connectionId,
      status: params.status ?? PresenceStatus.ONLINE,
      customState: params.customState,
      joinedAt: now,
      lastSeenAt: now,
      deviceInfo: params.deviceInfo,
    };

    this.store.set(presence);
    return presence;
  }

  /**
   * Leave a channel (remove presence)
   */
  leave(channelId: ChannelId, connectionId: ConnectionId): void {
    this.store.delete(channelId, connectionId);
  }

  /**
   * Leave all channels for a connection
   */
  leaveAll(connectionId: ConnectionId): ChannelId[] {
    const presences = this.store.getByConnection(connectionId);
    const channelIds: ChannelId[] = [];

    for (const presence of presences) {
      this.store.delete(presence.channelId, connectionId);
      channelIds.push(presence.channelId);
    }

    return channelIds;
  }

  /**
   * Update presence status
   */
  updateStatus(
    channelId: ChannelId,
    connectionId: ConnectionId,
    status: PresenceStatus
  ): Presence {
    const presence = this.store.get(channelId, connectionId);
    if (!presence) {
      throw new RealtimeError(
        RealtimeErrorCode.NOT_SUBSCRIBED,
        `No presence found for connection ${connectionId} in channel ${channelId}`
      );
    }

    const updated: Presence = {
      ...presence,
      status,
      lastSeenAt: new Date(),
    };

    this.store.set(updated);
    return updated;
  }

  /**
   * Update custom state
   */
  updateState(
    channelId: ChannelId,
    connectionId: ConnectionId,
    customState: Record<string, unknown>
  ): Presence {
    const presence = this.store.get(channelId, connectionId);
    if (!presence) {
      throw new RealtimeError(
        RealtimeErrorCode.NOT_SUBSCRIBED,
        `No presence found for connection ${connectionId} in channel ${channelId}`
      );
    }

    const updated: Presence = {
      ...presence,
      customState: { ...presence.customState, ...customState },
      lastSeenAt: new Date(),
    };

    this.store.set(updated);
    return updated;
  }

  /**
   * Touch presence (update last seen)
   */
  touch(channelId: ChannelId, connectionId: ConnectionId): void {
    const presence = this.store.get(channelId, connectionId);
    if (presence) {
      const updated: Presence = {
        ...presence,
        lastSeenAt: new Date(),
      };
      this.store.set(updated);
    }
  }

  /**
   * Get presence for a channel
   */
  getChannelPresence(channelId: ChannelId): Presence[] {
    return this.store.getByChannel(channelId);
  }

  /**
   * Get online users in a channel
   */
  getOnlineUsers(channelId: ChannelId): Presence[] {
    return this.store.getByChannel(channelId).filter(p => 
      p.status === PresenceStatus.ONLINE || 
      p.status === PresenceStatus.AWAY ||
      p.status === PresenceStatus.BUSY
    );
  }

  /**
   * Get presence for a user
   */
  getUserPresence(userId: string): Presence[] {
    return this.store.getByUser(userId);
  }

  /**
   * Get presence for a connection
   */
  getConnectionPresence(connectionId: ConnectionId): Presence[] {
    return this.store.getByConnection(connectionId);
  }

  /**
   * Get a specific presence entry
   */
  getPresence(channelId: ChannelId, connectionId: ConnectionId): Presence | undefined {
    return this.store.get(channelId, connectionId);
  }

  /**
   * Check if user is in channel
   */
  isUserInChannel(channelId: ChannelId, userId: string): boolean {
    const channelPresences = this.store.getByChannel(channelId);
    return channelPresences.some(p => p.userId === userId);
  }

  /**
   * Get channel member count
   */
  getMemberCount(channelId: ChannelId): number {
    return this.store.getByChannel(channelId).length;
  }

  /**
   * Clean up stale presence entries
   */
  cleanupStale(): Array<{ channelId: ChannelId; connectionId: ConnectionId }> {
    const stale: Array<{ channelId: ChannelId; connectionId: ConnectionId }> = [];

    // Note: In a real implementation, we'd need to iterate all presence entries
    // This is a simplified version
    return stale;
  }
}

/**
 * Create a presence entry
 */
export function createPresence(params: {
  channelId: ChannelId;
  connectionId: ConnectionId;
  userId: string;
  status?: PresenceStatus;
  customState?: Record<string, unknown>;
  deviceInfo?: DeviceInfo;
}): Presence {
  const now = new Date();
  return {
    channelId: params.channelId,
    userId: params.userId,
    connectionId: params.connectionId,
    status: params.status ?? PresenceStatus.ONLINE,
    customState: params.customState,
    joinedAt: now,
    lastSeenAt: now,
    deviceInfo: params.deviceInfo,
  };
}

/**
 * Check if a presence is online
 */
export function isOnline(presence: Presence): boolean {
  return presence.status === PresenceStatus.ONLINE ||
         presence.status === PresenceStatus.AWAY ||
         presence.status === PresenceStatus.BUSY;
}

/**
 * Check if a presence is visible (not invisible/offline)
 */
export function isVisible(presence: Presence): boolean {
  return presence.status !== PresenceStatus.INVISIBLE &&
         presence.status !== PresenceStatus.OFFLINE;
}

/** Presence change event types */
export type PresenceEvent =
  | { type: 'joined'; presence: Presence }
  | { type: 'left'; presence: Presence }
  | { type: 'updated'; presence: Presence; changes: Partial<Presence> };

/** Presence event listener */
export type PresenceListener = (event: PresenceEvent) => void;
