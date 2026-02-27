/**
 * Presence state management implementation
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  UserId,
  Clock,
  DefaultClock,
} from '../types.js';
import { PresenceStatus } from '../types.js';
import type {
  Presence,
  PresenceState,
  UserPresenceState,
  ConnectionPresenceState,
  PresenceDiff,
  PresenceStateManager,
  PresenceQuery,
} from './types.js';
import { PresenceError } from '../errors.js';

// ============================================================================
// Presence State Manager Implementation
// ============================================================================

export class DefaultPresenceStateManager implements PresenceStateManager {
  private readonly states = new Map<ChannelId, PresenceState>();
  private readonly history = new Map<ChannelId, PresenceEvent[]>();

  constructor(
    private readonly clock: Clock = DefaultClock,
    private readonly options: {
      maxHistorySize?: number;
      compressionEnabled?: boolean;
    } = {}
  ) {}

  // ============================================================================
  // State Operations
  // ============================================================================

  async getState(channelId: ChannelId): Promise<PresenceState | undefined> {
    return this.states.get(channelId);
  }

  async setState(channelId: ChannelId, state: PresenceState): Promise<void> {
    state.lastUpdated = this.clock.now();
    this.states.set(channelId, state);
  }

  // ============================================================================
  // Diff Operations
  // ============================================================================

  async getDiff(channelId: ChannelId, since: Date): Promise<PresenceDiff> {
    const state = this.states.get(channelId);
    if (!state) {
      return {
        joined: [],
        left: [],
        updated: [],
        timestamp: this.clock.now(),
      };
    }

    const history = this.history.get(channelId) || [];
    const relevantEvents = history.filter(event => event.timestamp >= since);

    const joined: Presence[] = [];
    const left: Presence[] = [];
    const updated: Presence[] = [];

    // Process events to build diff
    for (const event of relevantEvents) {
      switch (event.type) {
        case 'join':
          if (event.presence) {
            joined.push(event.presence);
          }
          break;
        case 'leave':
          // Remove from joined if it was added in this window
          const joinIndex = joined.findIndex(p => 
            p.userId === event.userId && p.connectionId === event.connectionId
          );
          if (joinIndex !== -1) {
            joined.splice(joinIndex, 1);
          } else {
            // Create a placeholder presence for left event
            left.push({
              channelId: event.channelId,
              userId: event.userId,
              connectionId: event.connectionId,
              status: 'offline' as any,
              joinedAt: event.timestamp,
              lastSeenAt: event.timestamp,
            });
          }
          break;
        case 'update':
          if (event.presence) {
            // Check if this is an update to a recently joined presence
            const existingJoin = joined.find(p => 
              p.userId === event.userId && p.connectionId === event.connectionId
            );
            if (existingJoin) {
              // Update the joined presence
              Object.assign(existingJoin, event.presence);
            } else {
              updated.push(event.presence);
            }
          }
          break;
      }
    }

    return {
      joined,
      left,
      updated,
      timestamp: this.clock.now(),
    };
  }

  async applyDiff(channelId: ChannelId, diff: PresenceDiff): Promise<void> {
    const state = this.states.get(channelId);
    if (!state) {
      // Create new state if it doesn't exist
      const newState: PresenceState = {
        channelId,
        users: new Map(),
        connections: new Map(),
        lastUpdated: this.clock.now(),
      };
      await this.setState(channelId, newState);
    }

    // Apply joins
    for (const presence of diff.joined) {
      await this.addPresence(presence);
    }

    // Apply leaves
    for (const presence of diff.left) {
      await this.removePresence(presence.channelId, presence.userId, presence.connectionId);
    }

    // Apply updates
    for (const presence of diff.updated) {
      await this.updatePresence(presence);
    }
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  async createSnapshot(channelId: ChannelId): Promise<PresenceState> {
    const state = this.states.get(channelId);
    if (!state) {
      throw new PresenceError('STATE_NOT_FOUND', `No state found for channel ${channelId}`);
    }

    // Deep clone the state
    return {
      channelId: state.channelId,
      users: new Map(
        Array.from(state.users.entries()).map(([userId, userState]) => [
          userId,
          {
            ...userState,
            connections: new Map(userState.connections),
          },
        ])
      ),
      connections: new Map(
        Array.from(state.connections.entries()).map(([connectionId, connState]) => [
          connectionId,
          {
            ...connState,
            channels: new Set(connState.channels),
          },
        ])
      ),
      lastUpdated: state.lastUpdated,
    };
  }

  async restoreSnapshot(channelId: ChannelId, snapshot: PresenceState): Promise<void> {
    // Validate snapshot
    if (snapshot.channelId !== channelId) {
      throw new PresenceError('INVALID_SNAPSHOT', 'Snapshot channel ID mismatch');
    }

    // Restore state
    this.states.set(channelId, {
      ...snapshot,
      users: new Map(
        Array.from(snapshot.users.entries()).map(([userId, userState]) => [
          userId,
          {
            ...userState,
            connections: new Map(userState.connections),
          },
        ])
      ),
      connections: new Map(
        Array.from(snapshot.connections.entries()).map(([connectionId, connState]) => [
          connectionId,
          {
            ...connState,
            channels: new Set(connState.channels),
          },
        ])
      ),
      lastUpdated: this.clock.now(),
    });

    // Clear history for this channel as we're restoring from snapshot
    this.history.delete(channelId);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async cleanup(channelId: ChannelId, olderThan: Date): Promise<void> {
    const state = this.states.get(channelId);
    if (!state) {
      return;
    }

    // Remove stale connections
    const staleConnections: ConnectionId[] = [];
    for (const [connectionId, connState] of state.connections.entries()) {
      if (connState.lastHeartbeat < olderThan) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections from users
    for (const connectionId of staleConnections) {
      await this.removeConnection(channelId, connectionId);
    }

    // Remove users with no connections
    const staleUsers: UserId[] = [];
    for (const [userId, userState] of state.users.entries()) {
      if (userState.connections.size === 0) {
        staleUsers.push(userId);
      }
    }

    for (const userId of staleUsers) {
      state.users.delete(userId);
    }

    // Clean up history
    const history = this.history.get(channelId);
    if (history) {
      const filtered = history.filter(event => event.timestamp >= olderThan);
      this.history.set(channelId, filtered);
    }

    state.lastUpdated = this.clock.now();
  }

  // ============================================================================
  // Presence Management Helpers
  // ============================================================================

  async addPresence(presence: Presence): Promise<void> {
    let state = this.states.get(presence.channelId);
    if (!state) {
      state = {
        channelId: presence.channelId,
        users: new Map(),
        connections: new Map(),
        lastUpdated: this.clock.now(),
      };
      this.states.set(presence.channelId, state);
    }

    // Update user state
    let userState = state.users.get(presence.userId);
    if (!userState) {
      userState = {
        userId: presence.userId,
        connections: new Map(),
        globalStatus: presence.status,
        lastSeen: presence.lastSeenAt,
      };
      state.users.set(presence.userId, userState);
    }

    // Add connection to user
    userState.connections.set(presence.connectionId, presence);
    userState.lastSeen = presence.lastSeenAt;

    // Update connection state
    let connState = state.connections.get(presence.connectionId);
    if (!connState) {
      connState = {
        connectionId: presence.connectionId,
        userId: presence.userId,
        channels: new Set(),
        lastHeartbeat: presence.lastSeenAt,
      };
      state.connections.set(presence.connectionId, connState);
    }

    connState.channels.add(presence.channelId);
    connState.lastHeartbeat = presence.lastSeenAt;

    // Record event
    this.recordEvent({
      type: 'join',
      channelId: presence.channelId,
      userId: presence.userId,
      connectionId: presence.connectionId,
      presence,
      timestamp: presence.joinedAt,
    });

    state.lastUpdated = this.clock.now();
  }

  async removePresence(channelId: ChannelId, userId: UserId, connectionId: ConnectionId): Promise<void> {
    const state = this.states.get(channelId);
    if (!state) {
      return;
    }

    // Remove from user state
    const userState = state.users.get(userId);
    if (userState) {
      userState.connections.delete(connectionId);
      
      // Remove user if no connections left
      if (userState.connections.size === 0) {
        state.users.delete(userId);
      }
    }

    // Remove connection state
    const connState = state.connections.get(connectionId);
    if (connState) {
      connState.channels.delete(channelId);
      
      // Remove connection if no channels left
      if (connState.channels.size === 0) {
        state.connections.delete(connectionId);
      }
    }

    // Record event
    this.recordEvent({
      type: 'leave',
      channelId,
      userId,
      connectionId,
      timestamp: this.clock.now(),
    });

    state.lastUpdated = this.clock.now();
  }

  async updatePresence(presence: Presence): Promise<void> {
    const state = this.states.get(presence.channelId);
    if (!state) {
      return;
    }

    // Update user state
    const userState = state.users.get(presence.userId);
    if (userState) {
      const connPresence = userState.connections.get(presence.connectionId);
      if (connPresence) {
        // Update connection presence
        Object.assign(connPresence, presence);
        userState.lastSeen = presence.lastSeenAt;
      }
    }

    // Update connection state heartbeat
    const connState = state.connections.get(presence.connectionId);
    if (connState) {
      connState.lastHeartbeat = presence.lastSeenAt;
    }

    // Record event
    this.recordEvent({
      type: 'update',
      channelId: presence.channelId,
      userId: presence.userId,
      connectionId: presence.connectionId,
      presence,
      timestamp: this.clock.now(),
    });

    state.lastUpdated = this.clock.now();
  }

  async removeConnection(channelId: ChannelId, connectionId: ConnectionId): Promise<void> {
    const state = this.states.get(channelId);
    if (!state) {
      return;
    }

    const connState = state.connections.get(connectionId);
    if (!connState) {
      return;
    }

    // Remove from user state
    const userState = state.users.get(connState.userId);
    if (userState) {
      userState.connections.delete(connectionId);
      
      // Remove user if no connections left
      if (userState.connections.size === 0) {
        state.users.delete(connState.userId);
      }
    }

    // Remove connection state
    state.connections.delete(connectionId);

    // Record event
    this.recordEvent({
      type: 'leave',
      channelId,
      userId: connState.userId,
      connectionId,
      timestamp: this.clock.now(),
    });
  }

  // ============================================================================
  // Event History Management
  // ============================================================================

  private recordEvent(event: PresenceEvent): void {
    let history = this.history.get(event.channelId);
    if (!history) {
      history = [];
      this.history.set(event.channelId, history);
    }

    history.push(event);

    // Trim history if it exceeds max size
    const maxSize = this.options.maxHistorySize || 1000;
    if (history.length > maxSize) {
      history.splice(0, history.length - maxSize);
    }
  }

  // ============================================================================
  // Query Support
  // ============================================================================

  async queryPresence(query: PresenceQuery): Promise<Presence[]> {
    const results: Presence[] = [];

    if (query.channelId) {
      const state = this.states.get(query.channelId);
      if (state) {
        for (const userState of state.users.values()) {
          for (const presence of userState.connections.values()) {
            results.push(presence);
          }
        }
      }
    } else {
      // Query all channels
      for (const state of this.states.values()) {
        for (const userState of state.users.values()) {
          for (const presence of userState.connections.values()) {
            results.push(presence);
          }
        }
      }
    }

    // Apply filters
    if (query.userIds && query.userIds.length > 0) {
      const userIdSet = new Set(query.userIds);
      return results.filter(p => userIdSet.has(p.userId));
    }

    if (query.connectionIds && query.connectionIds.length > 0) {
      const connectionSet = new Set(query.connectionIds);
      return results.filter(p => connectionSet.has(p.connectionId));
    }

    if (query.status) {
      return results.filter(p => p.status === query.status);
    }

    return results;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getAllStates(): Map<ChannelId, PresenceState> {
    return new Map(this.states);
  }

  clear(): void {
    this.states.clear();
    this.history.clear();
  }

  getStats(): {
    totalChannels: number;
    totalUsers: number;
    totalConnections: number;
    historySize: number;
  } {
    let totalUsers = 0;
    let totalConnections = 0;
    let historySize = 0;

    for (const state of this.states.values()) {
      totalUsers += state.users.size;
      totalConnections += state.connections.size;
    }

    for (const history of this.history.values()) {
      historySize += history.length;
    }

    return {
      totalChannels: this.states.size,
      totalUsers,
      totalConnections,
      historySize,
    };
  }
}

// ============================================================================
// Presence Event Types
// ============================================================================

export interface PresenceEvent {
  type: 'join' | 'leave' | 'update' | 'timeout';
  channelId: ChannelId;
  userId: UserId;
  connectionId: ConnectionId;
  presence?: Presence;
  timestamp: Date;
}
