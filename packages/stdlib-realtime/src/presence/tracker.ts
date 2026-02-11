/**
 * Presence tracker implementation
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  UserId,
  Clock,
} from '../types.js';
import { PresenceStatus, DefaultClock } from '../types.js';
import type {
  Presence,
  PresenceUpdate,
  PresenceQuery,
  PresenceEvent,
  PresenceTracker,
  PresenceStore,
  PresenceStats,
  PresenceEventEmitter,
  PresenceEventMap,
  PresenceConfig,
} from './types.js';
import { PresenceError, PresenceNotFoundError } from '../errors.js';

// ============================================================================
// Presence Tracker Implementation
// ============================================================================

export class DefaultPresenceTracker implements PresenceTracker, PresenceEventEmitter {
  private readonly eventHandlers = new Map<string, Set<Function>>();
  private cleanupTimer?: any;

  constructor(
    private readonly store: PresenceStore,
    private readonly clock: Clock = DefaultClock,
    private readonly config: PresenceConfig = {}
  ) {
    this.startCleanupTimer();
  }

  // ============================================================================
  // Join/Leave Operations
  // ============================================================================

  async join(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    options: {
      status?: PresenceStatus;
      customState?: Record<string, any>;
      deviceInfo?: Presence['deviceInfo'];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Presence> {
    const now = this.clock.now();

    // Check if already present
    const existing = await this.store.get(channelId, userId);
    if (existing && existing.connectionId === connectionId) {
      // Update existing presence
      const updated = await this.update(channelId, userId, connectionId, {
        userId,
        connectionId,
        status: options.status || existing.status,
        customState: { ...existing.customState, ...options.customState },
        metadata: { ...existing.metadata, ...options.metadata },
      });
      return updated || existing;
    }

    // Create new presence
    const presence: Presence = {
      channelId,
      userId,
      connectionId,
      status: options.status || PresenceStatus.ONLINE,
      customState: options.customState,
      joinedAt: now,
      lastSeenAt: now,
      deviceInfo: options.deviceInfo,
      metadata: options.metadata,
    };

    await this.store.add(presence);
    this.emit('presence:joined', { presence });

    return presence;
  }

  async leave(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    reason?: string
  ): Promise<boolean> {
    const presence = await this.store.get(channelId, userId);
    if (!presence || presence.connectionId !== connectionId) {
      return false;
    }

    const removed = await this.store.remove(channelId, userId, connectionId);
    if (removed) {
      this.emit('presence:left', { channelId, userId, connectionId, reason });
    }

    return removed;
  }

  async leaveAll(connectionId: ConnectionId, reason?: string): Promise<number> {
    const presences = await this.store.getConnectionPresences(connectionId);
    let removed = 0;

    for (const presence of presences) {
      if (await this.store.remove(presence.channelId, presence.userId, connectionId)) {
        this.emit('presence:left', { 
          channelId: presence.channelId, 
          userId: presence.userId, 
          connectionId, 
          reason 
        });
        removed++;
      }
    }

    return removed;
  }

  // ============================================================================
  // Update Operations
  // ============================================================================

  async update(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    updates: PresenceUpdate
  ): Promise<Presence | undefined> {
    const presence = await this.store.get(channelId, userId);
    if (!presence || presence.connectionId !== connectionId) {
      return undefined;
    }

    const now = this.clock.now();
    const changes: string[] = [];

    // Apply updates
    if (updates.status !== undefined && updates.status !== presence.status) {
      presence.status = updates.status;
      changes.push('status');
    }

    if (updates.customState !== undefined) {
      presence.customState = { ...presence.customState, ...updates.customState };
      changes.push('customState');
    }

    if (updates.metadata !== undefined) {
      presence.metadata = { ...presence.metadata, ...updates.metadata };
      changes.push('metadata');
    }

    presence.lastSeenAt = now;

    // Update in store
    await this.store.update(channelId, userId, presence);
    if (changes.length > 0) {
      this.emit('presence:updated', { presence, changes });
    }

    return presence;
  }

  async updateStatus(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    status: PresenceStatus
  ): Promise<Presence | undefined> {
    return this.update(channelId, userId, connectionId, { 
      userId, 
      connectionId, 
      status 
    });
  }

  async updateCustomState(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId,
    customState: Record<string, any>
  ): Promise<Presence | undefined> {
    return this.update(channelId, userId, connectionId, { 
      userId, 
      connectionId, 
      customState 
    });
  }

  // ============================================================================
  // Heartbeat
  // ============================================================================

  async heartbeat(
    channelId: ChannelId,
    userId: UserId,
    connectionId: ConnectionId
  ): Promise<void> {
    const presence = await this.store.get(channelId, userId);
    if (!presence || presence.connectionId !== connectionId) {
      return;
    }

    presence.lastSeenAt = this.clock.now();
    await this.store.update(channelId, userId, presence);
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  async get(channelId: ChannelId, userId: UserId): Promise<Presence | undefined> {
    return this.store.get(channelId, userId);
  }

  async getByConnection(connectionId: ConnectionId): Promise<Presence | undefined> {
    return this.store.getByConnection(connectionId);
  }

  async list(channelId: ChannelId, options: PresenceQuery = {}): Promise<Presence[]> {
    const query: PresenceQuery = { channelId, ...options };
    return this.store.query(query);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async getStats(channelId: ChannelId): Promise<PresenceStats> {
    const presences = await this.store.getChannelPresences(channelId);
    const now = this.clock.now();

    // Count by status
    const statusCounts = presences.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<PresenceStatus, number>);

    // Analyze devices
    const deviceCounts = presences.reduce((acc, p) => {
      const type = p.deviceInfo?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analyze locations
    const locationCounts = presences.reduce((acc, p) => {
      const country = p.location?.country || 'unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average session duration
    const totalDuration = presences.reduce((sum, p) => {
      return sum + (now.getTime() - p.joinedAt.getTime());
    }, 0);
    const avgDuration = presences.length > 0 ? totalDuration / presences.length / 1000 : 0;

    const totalConnections = presences.length;
    const topDevices = Object.entries(deviceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalConnections) * 100,
      }));

    const topLocations = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({
        country,
        count,
        percentage: (count / totalConnections) * 100,
      }));

    return {
      channelId,
      totalUsers: new Set(presences.map(p => p.userId)).size,
      onlineUsers: statusCounts[PresenceStatus.ONLINE] || 0,
      awayUsers: statusCounts[PresenceStatus.AWAY] || 0,
      busyUsers: statusCounts[PresenceStatus.BUSY] || 0,
      invisibleUsers: statusCounts[PresenceStatus.INVISIBLE] || 0,
      totalConnections,
      joinRate: 0, // Would need time-window tracking
      leaveRate: 0, // Would need time-window tracking
      averageSessionDuration: avgDuration,
      topDevices,
      topLocations,
    };
  }

  async getAllStats(): Promise<Record<ChannelId, PresenceStats>> {
    // In a real implementation, this would be optimized
    const allPresences = await this.store.query({});
    const channelIds = new Set(allPresences.map(p => p.channelId));
    const stats: Record<ChannelId, PresenceStats> = {};

    for (const channelId of channelIds) {
      stats[channelId] = await this.getStats(channelId);
    }

    return stats;
  }

  // ============================================================================
  // Event Emitter Implementation
  // ============================================================================

  on<T extends keyof PresenceEventMap>(event: T, handler: (data: PresenceEventMap[T]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off<T extends keyof PresenceEventMap>(event: T, handler: (data: PresenceEventMap[T]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  emit<T extends keyof PresenceEventMap>(event: T, data: PresenceEventMap[T]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in presence event handler for ${event}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startCleanupTimer(): void {
    if (!this.config.cleanupInterval) {
      return;
    }

    this.cleanupTimer = this.clock.setInterval(async () => {
      await this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const timeoutThreshold = this.config.timeoutThreshold || 300000; // 5 minutes default
    const cutoff = new Date(this.clock.now().getTime() - timeoutThreshold);

    try {
      const removed = await this.store.removeExpired(cutoff);
      if (removed > 0) {
        // Get affected channels
        const expiredPresences = await this.store.query({
          onlineOnly: false,
          includeOffline: true,
        });
        const affectedChannels = new Set(
          expiredPresences
            .filter(p => p.lastSeenAt < cutoff)
            .map(p => p.channelId)
        );

        this.emit('presence:cleaned', { 
          count: removed, 
          channelIds: Array.from(affectedChannels) 
        });
      }
    } catch (error) {
      console.error('Error during presence cleanup:', error);
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.cleanupTimer) {
      this.clock.clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.eventHandlers.clear();
  }
}

// ============================================================================
// In-Memory Presence Store
// ============================================================================

export class InMemoryPresenceStore implements PresenceStore {
  private readonly presences = new Map<string, Presence>(); // key: channelId:userId
  private readonly connectionIndex = new Map<ConnectionId, Presence>();
  private readonly channelIndex = new Map<ChannelId, Set<string>>();

  private getKey(channelId: ChannelId, userId: UserId): string {
    return `${channelId}:${userId}`;
  }

  async get(channelId: ChannelId, userId: UserId): Promise<Presence | undefined> {
    return this.presences.get(this.getKey(channelId, userId));
  }

  async getByConnection(connectionId: ConnectionId): Promise<Presence | undefined> {
    return this.connectionIndex.get(connectionId);
  }

  async add(presence: Presence): Promise<void> {
    const key = this.getKey(presence.channelId, presence.userId);
    
    // Remove existing if present
    const existing = this.presences.get(key);
    if (existing) {
      this.connectionIndex.delete(existing.connectionId);
    }

    // Add new presence
    this.presences.set(key, presence);
    this.connectionIndex.set(presence.connectionId, presence);

    // Update channel index
    if (!this.channelIndex.has(presence.channelId)) {
      this.channelIndex.set(presence.channelId, new Set());
    }
    this.channelIndex.get(presence.channelId)!.add(key);
  }

  async update(
    channelId: ChannelId,
    userId: UserId,
    updates: Partial<Presence>
  ): Promise<boolean> {
    const key = this.getKey(channelId, userId);
    const presence = this.presences.get(key);
    
    if (!presence) {
      return false;
    }

    // Apply updates
    Object.assign(presence, updates);
    
    // Update indexes if connection changed
    if (updates.connectionId && updates.connectionId !== presence.connectionId) {
      this.connectionIndex.delete(presence.connectionId);
      this.connectionIndex.set(updates.connectionId, presence);
    }

    return true;
  }

  async remove(
    channelId: ChannelId,
    userId: UserId,
    connectionId?: ConnectionId
  ): Promise<boolean> {
    const key = this.getKey(channelId, userId);
    const presence = this.presences.get(key);
    
    if (!presence) {
      return false;
    }

    // Check connection match if provided
    if (connectionId && presence.connectionId !== connectionId) {
      return false;
    }

    // Remove from all indexes
    this.presences.delete(key);
    this.connectionIndex.delete(presence.connectionId);
    
    const channelKeys = this.channelIndex.get(channelId);
    if (channelKeys) {
      channelKeys.delete(key);
      if (channelKeys.size === 0) {
        this.channelIndex.delete(channelId);
      }
    }

    return true;
  }

  async query(query: PresenceQuery): Promise<Presence[]> {
    let results: Presence[] = [];

    if (query.channelId) {
      const channelKeys = this.channelIndex.get(query.channelId);
      if (channelKeys) {
        results = Array.from(channelKeys).map(key => this.presences.get(key)!);
      }
    } else {
      results = Array.from(this.presences.values());
    }

    // Apply filters
    if (query.userIds && query.userIds.length > 0) {
      const userIdSet = new Set(query.userIds);
      results = results.filter(p => userIdSet.has(p.userId));
    }

    if (query.connectionIds && query.connectionIds.length > 0) {
      const connectionSet = new Set(query.connectionIds);
      results = results.filter(p => connectionSet.has(p.connectionId));
    }

    if (query.status) {
      results = results.filter(p => p.status === query.status);
    }

    if (query.onlineOnly) {
      results = results.filter(p => p.status !== PresenceStatus.OFFLINE);
    }

    if (!query.includeOffline) {
      results = results.filter(p => p.status !== PresenceStatus.OFFLINE);
    }

    if (query.customState) {
      results = results.filter(p => {
        if (!p.customState) return false;
        return Object.entries(query.customState!).every(([key, value]) => 
          p.customState![key] === value
        );
      });
    }

    return results;
  }

  async getChannelPresences(
    channelId: ChannelId,
    options: { includeOffline?: boolean } = {}
  ): Promise<Presence[]> {
    return this.query({ channelId, includeOffline: options.includeOffline });
  }

  async getUserPresences(userId: UserId): Promise<Presence[]> {
    return Array.from(this.presences.values()).filter(p => p.userId === userId);
  }

  async getConnectionPresences(connectionId: ConnectionId): Promise<Presence[]> {
    const presence = this.connectionIndex.get(connectionId);
    return presence ? [presence] : [];
  }

  async count(channelId: ChannelId, options?: { status?: PresenceStatus }): Promise<number> {
    const query: PresenceQuery = { channelId };
    if (options?.status) {
      query.status = options.status;
    }
    const presences = await this.query(query);
    return presences.length;
  }

  async countTotal(): Promise<number> {
    return this.presences.size;
  }

  async removeExpired(before: Date): Promise<number> {
    let removed = 0;
    const toRemove: string[] = [];

    for (const [key, presence] of this.presences.entries()) {
      if (presence.lastSeenAt < before) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const presence = this.presences.get(key)!;
      this.presences.delete(key);
      this.connectionIndex.delete(presence.connectionId);
      
      const channelKeys = this.channelIndex.get(presence.channelId);
      if (channelKeys) {
        channelKeys.delete(key);
        if (channelKeys.size === 0) {
          this.channelIndex.delete(presence.channelId);
        }
      }
      
      removed++;
    }

    return removed;
  }

  async clear(): Promise<void> {
    this.presences.clear();
    this.connectionIndex.clear();
    this.channelIndex.clear();
  }
}
