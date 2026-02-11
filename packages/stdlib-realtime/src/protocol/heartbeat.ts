/**
 * Heartbeat manager implementation
 * @packageDocumentation
 */

import type {
  ConnectionId,
  Clock,
  DefaultClock,
} from '../types.js';
import type {
  HeartbeatConfig,
  HeartbeatManager,
} from './types.js';
import { ConnectionTimeoutError } from '../errors.js';

// ============================================================================
// Connection Heartbeat State
// ============================================================================

interface ConnectionHeartbeatState {
  connectionId: ConnectionId;
  config: Required<HeartbeatConfig>;
  active: boolean;
  timer?: any;
  timeoutTimer?: any;
  missedCount: number;
  lastPing: number;
  lastPong: number;
  latency: number;
  pingsInFlight: Set<number>;
}

// ============================================================================
// Heartbeat Manager Implementation
// ============================================================================

export class DefaultHeartbeatManager implements HeartbeatManager {
  private readonly connections = new Map<ConnectionId, ConnectionHeartbeatState>();
  private globalCleanupTimer?: any;

  constructor(
    private readonly clock: Clock = DefaultClock,
    private readonly defaultConfig: Partial<HeartbeatConfig> = {}
  ) {
    this.startGlobalCleanup();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  addConnection(connectionId: ConnectionId, config?: Partial<HeartbeatConfig>): void {
    const mergedConfig: Required<HeartbeatConfig> = {
      interval: config?.interval || this.defaultConfig.interval || 30000,
      timeout: config?.timeout || this.defaultConfig.timeout || 5000,
      maxMissed: config?.maxMissed || this.defaultConfig.maxMissed || 3,
      jitter: config?.jitter || this.defaultConfig.jitter || 0,
      onTimeout: config?.onTimeout || this.defaultConfig.onTimeout,
      onPing: config?.onPing || this.defaultConfig.onPing,
      onPong: config?.onPong || this.defaultConfig.onPong,
    };

    const state: ConnectionHeartbeatState = {
      connectionId,
      config: mergedConfig,
      active: false,
      missedCount: 0,
      lastPing: 0,
      lastPong: 0,
      latency: 0,
      pingsInFlight: new Set(),
    };

    this.connections.set(connectionId, state);
  }

  removeConnection(connectionId: ConnectionId): void {
    const state = this.connections.get(connectionId);
    if (state) {
      this.stopHeartbeat(state);
      this.connections.delete(connectionId);
    }
  }

  // ============================================================================
  // Control
  // ============================================================================

  start(connectionId?: ConnectionId): void {
    if (connectionId) {
      const state = this.connections.get(connectionId);
      if (state && !state.active) {
        this.startHeartbeat(state);
      }
    } else {
      // Start all connections
      for (const state of this.connections.values()) {
        if (!state.active) {
          this.startHeartbeat(state);
        }
      }
    }
  }

  stop(connectionId?: ConnectionId): void {
    if (connectionId) {
      const state = this.connections.get(connectionId);
      if (state && state.active) {
        this.stopHeartbeat(state);
      }
    } else {
      // Stop all connections
      for (const state of this.connections.values()) {
        if (state.active) {
          this.stopHeartbeat(state);
        }
      }
    }
  }

  // ============================================================================
  // Ping/Pong Handling
  // ============================================================================

  async ping(connectionId: ConnectionId): Promise<number> {
    const state = this.connections.get(connectionId);
    if (!state) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const pingId = this.generatePingId();
    const pingTime = this.clock.now().getTime();

    // Track ping
    state.lastPing = pingTime;
    state.pingsInFlight.add(pingId);

    // Call ping handler
    if (state.config.onPing) {
      try {
        await state.config.onPing(connectionId);
      } catch (error) {
        console.error(`Error in ping handler for connection ${connectionId}:`, error);
      }
    }

    // Wait for pong with timeout
    return new Promise<number>((resolve, reject) => {
      const checkPong = () => {
        if (!state.pingsInFlight.has(pingId)) {
          // Pong received
          resolve(state.latency);
        } else {
          // Check timeout
          if (this.clock.now().getTime() - pingTime > state.config.timeout) {
            state.pingsInFlight.delete(pingId);
            reject(new ConnectionTimeoutError(connectionId));
          } else {
            // Check again
            this.clock.setTimeout(checkPong, 100);
          }
        }
      };

      checkPong();
    });
  }

  handlePong(connectionId: ConnectionId, data?: any): void {
    const state = this.connections.get(connectionId);
    if (!state) {
      return;
    }

    const now = this.clock.now().getTime();
    
    // Calculate latency if we have ping timestamp
    if (data && typeof data.originalTimestamp === 'number') {
      state.latency = now - data.originalTimestamp;
    } else if (state.lastPing > 0) {
      state.latency = now - state.lastPing;
    }

    state.lastPong = now;
    state.missedCount = 0;
    
    // Clear all in-flight pongs (we don't track individual ping IDs in this simple implementation)
    state.pingsInFlight.clear();

    // Restart heartbeat if it was stopped due to missed pings
    if (!state.active) {
      this.startHeartbeat(state);
    }

    // Call pong handler
    if (state.config.onPong) {
      try {
        state.config.onPong(connectionId, state.latency);
      } catch (error) {
        console.error(`Error in pong handler for connection ${connectionId}:`, error);
      }
    }
  }

  // ============================================================================
  // Status
  // ============================================================================

  isAlive(connectionId: ConnectionId): boolean {
    const state = this.connections.get(connectionId);
    if (!state) {
      return false;
    }

    // Check if we've received a pong recently
    const timeSinceLastPong = this.clock.now().getTime() - state.lastPong;
    return timeSinceLastPong <= state.config.timeout;
  }

  getLatency(connectionId: ConnectionId): number | undefined {
    const state = this.connections.get(connectionId);
    return state?.latency;
  }

  getLastSeen(connectionId: ConnectionId): Date | undefined {
    const state = this.connections.get(connectionId);
    if (!state || state.lastPong === 0) {
      return undefined;
    }
    return new Date(state.lastPong);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup(): void {
    // Stop all heartbeats
    this.stop();

    // Clear all connections
    this.connections.clear();

    // Clear global cleanup timer
    if (this.globalCleanupTimer) {
      this.clock.clearInterval(this.globalCleanupTimer);
      this.globalCleanupTimer = undefined;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startHeartbeat(state: ConnectionHeartbeatState): void {
    if (state.active) {
      return;
    }

    state.active = true;
    this.scheduleNextPing(state);
  }

  private stopHeartbeat(state: ConnectionHeartbeatState): void {
    if (!state.active) {
      return;
    }

    state.active = false;

    // Clear timers
    if (state.timer) {
      this.clock.clearTimeout(state.timer);
      state.timer = undefined;
    }

    if (state.timeoutTimer) {
      this.clock.clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }
  }

  private scheduleNextPing(state: ConnectionHeartbeatState): void {
    if (!state.active) {
      return;
    }

    // Calculate next ping time with jitter
    let delay = state.config.interval;
    if (state.config.jitter > 0) {
      const jitter = Math.random() * state.config.jitter - state.config.jitter / 2;
      delay += jitter;
    }

    state.timer = this.clock.setTimeout(() => {
      this.sendPing(state);
    }, delay);
  }

  private async sendPing(state: ConnectionHeartbeatState): Promise<void> {
    if (!state.active) {
      return;
    }

    try {
      const pingTime = this.clock.now().getTime();
      state.lastPing = pingTime;

      // Call ping handler
      if (state.config.onPing) {
        await state.config.onPing(state.connectionId);
      }

      // Schedule timeout check
      state.timeoutTimer = this.clock.setTimeout(() => {
        this.handlePingTimeout(state);
      }, state.config.timeout);

      // Schedule next ping
      this.scheduleNextPing(state);

    } catch (error) {
      console.error(`Error sending ping for connection ${state.connectionId}:`, error);
      this.handlePingTimeout(state);
    }
  }

  private handlePingTimeout(state: ConnectionHeartbeatState): void {
    if (!state.active) {
      return;
    }

    state.missedCount++;

    if (state.missedCount >= state.config.maxMissed) {
      // Too many missed pings - connection is dead
      this.stopHeartbeat(state);

      // Call timeout handler
      if (state.config.onTimeout) {
        try {
          state.config.onTimeout(state.connectionId);
        } catch (error) {
          console.error(`Error in timeout handler for connection ${state.connectionId}:`, error);
        }
      }
    } else {
      // Schedule another ping immediately
      this.clock.setTimeout(() => {
        this.sendPing(state);
      }, 1000); // Retry after 1 second
    }
  }

  private startGlobalCleanup(): void {
    // Clean up stale connections every minute
    this.globalCleanupTimer = this.clock.setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000);
  }

  private cleanupStaleConnections(): void {
    const now = this.clock.now().getTime();
    const staleConnections: ConnectionId[] = [];

    for (const [connectionId, state] of this.connections.entries()) {
      // Check if connection is stale (no pong for 5 minutes)
      if (state.lastPong > 0 && (now - state.lastPong) > 300000) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      console.warn(`Removing stale connection ${connectionId}`);
      this.removeConnection(connectionId);
    }
  }

  private generatePingId(): number {
    return Math.random() * 1000000 | 0;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): {
    totalConnections: number;
    activeConnections: number;
    averageLatency: number;
    connectionsWithIssues: number;
  } {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(c => c.active).length;
    const connectionsWithIssues = connections.filter(c => 
      c.missedCount > 0 || !this.isAlive(c.connectionId)
    ).length;

    const totalLatency = connections.reduce((sum, c) => sum + c.latency, 0);
    const averageLatency = connections.length > 0 ? totalLatency / connections.length : 0;

    return {
      totalConnections: connections.length,
      activeConnections,
      averageLatency,
      connectionsWithIssues,
    };
  }
}

// ============================================================================
// Heartbeat Factory
// ============================================================================

export class HeartbeatFactory {
  static create(
    clock?: Clock,
    defaultConfig?: Partial<HeartbeatConfig>
  ): HeartbeatManager {
    return new DefaultHeartbeatManager(clock, defaultConfig);
  }

  static createWithDefaults(
    config: {
      interval?: number;
      timeout?: number;
      maxMissed?: number;
    },
    clock?: Clock
  ): HeartbeatManager {
    return new DefaultHeartbeatManager(clock, config);
  }
}

// ============================================================================
// Default Heartbeat Configurations
// ============================================================================

export const DefaultHeartbeatConfigs = {
  // For real-time applications
  realtime: {
    interval: 15000, // 15 seconds
    timeout: 5000,   // 5 seconds
    maxMissed: 3,
    jitter: 1000,    // ±1 second
  },

  // For less critical applications
  relaxed: {
    interval: 60000, // 1 minute
    timeout: 10000,  // 10 seconds
    maxMissed: 2,
    jitter: 5000,    // ±5 seconds
  },

  // For high-frequency trading or gaming
  highFrequency: {
    interval: 5000,  // 5 seconds
    timeout: 2000,   // 2 seconds
    maxMissed: 2,
    jitter: 500,     // ±0.5 seconds
  },

  // For mobile connections
  mobile: {
    interval: 30000, // 30 seconds
    timeout: 15000,  // 15 seconds
    maxMissed: 3,
    jitter: 5000,    // ±5 seconds
  },
} as const;
