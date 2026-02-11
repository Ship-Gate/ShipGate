/**
 * Comprehensive tests for stdlib-realtime
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Imports
// ============================================================================

import {
  // Core types
  ConnectionId,
  ChannelId,
  MessageId,
  UserId,
  Protocol,
  ConnectionStatus,
  ChannelType,
  PresenceStatus,
  MessageType,
  Priority,
  
  // Errors
  RealtimeError,
  ConnectionError,
  ChannelError,
  MessageError,
  PresenceError,
  ConnectionNotFoundError,
  ChannelNotFoundError,
  MessageTooLargeError,
  
  // Clock
  DefaultClock,
  ExponentialBackoff,
  FixedDelay,
  
  // WebSocket
  WebSocketServer,
  WebSocketClient,
  WebSocketConnectionFactory,
  
  // SSE
  SSEServer,
  SSEClient,
  
  // Channels
  ChannelManager,
  ChannelFactory,
  InMemoryChannelStore,
  InMemoryChannelSubscriptionStore,
  InMemoryMessageHistoryStore,
  DefaultChannelAuthorizer,
  RoleBasedAuthorizer,
  
  // Presence
  DefaultPresenceTracker,
  InMemoryPresenceStore,
  DefaultPresenceStateManager,
  
  // Protocol
  DefaultProtocolCodec,
  DefaultHeartbeatManager,
  CodecFactory,
  HeartbeatFactory,
} from '../src/index.js';

// ============================================================================
// Mock Clock for Testing
// ============================================================================

class MockClock {
  private currentTime = Date.now();
  private timers = new Map<number, { callback: () => void; delay: number; repeat: boolean }>();
  private nextTimerId = 1;

  now(): Date {
    return new Date(this.currentTime);
  }

  advanceTime(ms: number): void {
    this.currentTime += ms;
    this.checkTimers();
  }

  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextTimerId++;
    this.timers.set(id, { callback, delay: this.currentTime + delay, repeat: false });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  setInterval(callback: () => void, interval: number): number {
    const id = this.nextTimerId++;
    this.timers.set(id, { callback, delay: this.currentTime + interval, repeat: true });
    return id;
  }

  clearInterval(id: number): void {
    this.timers.delete(id);
  }

  private checkTimers(): void {
    for (const [id, timer] of this.timers.entries()) {
      if (this.currentTime >= timer.delay) {
        timer.callback();
        
        if (timer.repeat) {
          timer.delay = this.currentTime + timer.delay;
        } else {
          this.timers.delete(id);
        }
      }
    }
  }
}

// ============================================================================
// Channel Tests
// ============================================================================

describe('Channel Management', () => {
  let channelManager: ChannelManager;
  let mockClock: MockClock;

  beforeEach(() => {
    mockClock = new MockClock();
    const channelStore = new InMemoryChannelStore();
    const subscriptionStore = new InMemoryChannelSubscriptionStore();
    const historyStore = new InMemoryMessageHistoryStore();
    const authorizer = new DefaultChannelAuthorizer({
      publicChannels: ['*'], // Allow all channels
      requireAuthForSubscribe: false,
      requireAuthForPublish: false,
    });
    
    channelManager = new ChannelManager(
      channelStore,
      subscriptionStore,
      historyStore,
      authorizer,
      undefined,
      mockClock
    );
  });

  it('should create and manage channels', async () => {
    const channel = await channelManager.createChannel(
      'test-channel',
      ChannelType.BROADCAST,
      { maxMessageSize: 1024 }
    );

    expect(channel).toBeDefined();
    expect(channel.name).toBe('test-channel');
    expect(channel.type).toBe(ChannelType.BROADCAST);
    expect(channel.config.maxMessageSize).toBe(1024);
  });

  it('should handle subscriptions', async () => {
    const channel = await channelManager.createChannel(
      'test-channel',
      ChannelType.BROADCAST,
      { maxMessageSize: 1024 }
    );

    const result = await channelManager.subscribe('conn-1', channel.id);
    expect(result.channel).toBeDefined();
    expect(result.history).toBeDefined();

    const subscribers = await channelManager.getSubscribers(channel.id);
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0].connectionId).toBe('conn-1');
  });

  it('should publish messages to subscribers', async () => {
    const channel = await channelManager.createChannel(
      'test-channel',
      ChannelType.BROADCAST,
      { maxMessageSize: 1024 }
    );

    await channelManager.subscribe('conn-1', channel.id);
    await channelManager.subscribe('conn-2', channel.id);

    const result = await channelManager.publish(
      channel.id,
      'test-event',
      { message: 'hello' },
      { connectionId: 'conn-1' }
    );

    expect(result.messageId).toBeDefined();
    expect(result.deliveredTo).toBe(2);
  });

  it('should handle unsubscribe', async () => {
    const channel = await channelManager.createChannel(
      'test-channel',
      ChannelType.BROADCAST,
      { maxMessageSize: 1024 }
    );

    await channelManager.subscribe('conn-1', channel.id);
    await channelManager.unsubscribe('conn-1', channel.id);

    const subscribers = await channelManager.getSubscribers(channel.id);
    expect(subscribers).toHaveLength(0);
  });
});

// ============================================================================
// Presence Tests
// ============================================================================

describe('Presence Management', () => {
  let presenceTracker: DefaultPresenceTracker;
  let presenceStore: InMemoryPresenceStore;
  let mockClock: MockClock;

  beforeEach(() => {
    mockClock = new MockClock();
    presenceStore = new InMemoryPresenceStore();
    presenceTracker = new DefaultPresenceTracker(presenceStore, mockClock);
  });

  it('should track user presence in channels', async () => {
    const presence = await presenceTracker.join(
      'channel-1',
      'user-1',
      'conn-1',
      { status: PresenceStatus.ONLINE }
    );

    expect(presence).toBeDefined();
    expect(presence.channelId).toBe('channel-1');
    expect(presence.userId).toBe('user-1');
    expect(presence.connectionId).toBe('conn-1');
    expect(presence.status).toBe(PresenceStatus.ONLINE);
  });

  it('should handle presence updates', async () => {
    await presenceTracker.join('channel-1', 'user-1', 'conn-1');
    
    const updated = await presenceTracker.updateStatus(
      'channel-1',
      'user-1',
      'conn-1',
      PresenceStatus.AWAY
    );

    expect(updated).toBeDefined();
    expect(updated!.status).toBe(PresenceStatus.AWAY);
  });

  it('should handle user leaving channels', async () => {
    await presenceTracker.join('channel-1', 'user-1', 'conn-1');
    
    const left = await presenceTracker.leave('channel-1', 'user-1', 'conn-1');
    expect(left).toBe(true);

    const presence = await presenceTracker.get('channel-1', 'user-1');
    expect(presence).toBeUndefined();
  });

  it('should list presences in a channel', async () => {
    await presenceTracker.join('channel-1', 'user-1', 'conn-1');
    await presenceTracker.join('channel-1', 'user-2', 'conn-2');
    await presenceTracker.join('channel-2', 'user-3', 'conn-3');

    const channelPresences = await presenceTracker.list('channel-1');
    expect(channelPresences).toHaveLength(2);
    expect(channelPresences.map(p => p.userId)).toEqual(['user-1', 'user-2']);
  });

  it('should get presence statistics', async () => {
    await presenceTracker.join('channel-1', 'user-1', 'conn-1', { status: PresenceStatus.ONLINE });
    await presenceTracker.join('channel-1', 'user-2', 'conn-2', { status: PresenceStatus.AWAY });
    await presenceTracker.join('channel-1', 'user-3', 'conn-3', { status: PresenceStatus.BUSY });

    const stats = await presenceTracker.getStats('channel-1');
    expect(stats.totalUsers).toBe(3);
    expect(stats.onlineUsers).toBe(1);
    expect(stats.awayUsers).toBe(1);
    expect(stats.busyUsers).toBe(1);
    expect(stats.totalConnections).toBe(3);
  });
});

// ============================================================================
// Protocol Tests
// ============================================================================

describe('Protocol Codec', () => {
  let codec: DefaultProtocolCodec;

  beforeEach(() => {
    codec = CodecFactory.createDefault();
  });

  it('should encode and decode messages', async () => {
    const packet = {
      header: {
        id: 'msg-123',
        type: MessageType.EVENT,
        timestamp: Date.now(),
        version: '1.0.0',
        flags: 0,
      },
      payload: {
        type: 'event',
        data: {
          event: 'test-event',
          channelId: 'channel-1',
          data: { message: 'hello' },
        },
      },
    };

    const encoded = await codec.encode(packet);
    expect(encoded).toBeInstanceOf(Uint8Array);

    const decoded = await codec.decode(encoded);
    expect(decoded).toEqual(packet);
  });

  it('should validate packets', async () => {
    const validPacket = {
      header: {
        id: 'msg-123',
        type: MessageType.PING,
        timestamp: Date.now(),
        version: '1.0.0',
        flags: 0,
      },
      payload: {
        type: 'ping',
        data: {},
      },
    };

    const isValid = await codec.validate(validPacket);
    expect(isValid).toBe(true);

    const invalidPacket = {
      header: {
        id: 'msg-123',
        type: MessageType.PING,
        timestamp: Date.now(),
        version: '2.0.0', // Unsupported version
        flags: 0,
      },
      payload: {
        type: 'ping',
        data: {},
      },
    };

    const isInvalid = await codec.validate(invalidPacket);
    expect(isInvalid).toBe(false);
  });

  it('should track statistics', async () => {
    const packet = {
      header: {
        id: 'msg-123',
        type: MessageType.PING,
        timestamp: Date.now(),
        version: '1.0.0',
        flags: 0,
      },
      payload: {
        type: 'ping',
        data: {},
      },
    };

    await codec.encode(packet);
    await codec.decode(await codec.encode(packet));

    const stats = codec.getStats();
    expect(stats.messagesEncoded).toBe(2);
    expect(stats.messagesDecoded).toBe(1);
    expect(stats.errors).toBe(0);
  });
});

// ============================================================================
// Heartbeat Tests
// ============================================================================

describe('Heartbeat Manager', () => {
  let heartbeatManager: DefaultHeartbeatManager;
  let mockClock: MockClock;
  let timeoutCallback: any;

  beforeEach(() => {
    mockClock = new MockClock();
    timeoutCallback = vi.fn();
    
    heartbeatManager = HeartbeatFactory.createWithDefaults(
      {
        interval: 1000,
        timeout: 500,
        maxMissed: 3,
      },
      mockClock
    );
  });

  afterEach(() => {
    heartbeatManager.cleanup();
  });

  it('should track connection heartbeat state', () => {
    heartbeatManager.addConnection('conn-1', {
      onTimeout: timeoutCallback,
    });

    expect(heartbeatManager.isAlive('conn-1')).toBe(false);
  });

  it('should handle ping/pong', async () => {
    heartbeatManager.addConnection('conn-1');
    heartbeatManager.start('conn-1');

    // Simulate ping
    const pingPromise = heartbeatManager.ping('conn-1');
    
    // Simulate pong response
    mockClock.advanceTime(50);
    heartbeatManager.handlePong('conn-1', { originalTimestamp: Date.now() - 50 });

    const latency = await pingPromise;
    expect(latency).toBeGreaterThanOrEqual(50);
    expect(heartbeatManager.getLatency('conn-1')).toBe(latency);
  });

  it('should detect timeouts', () => {
    heartbeatManager.addConnection('conn-1', {
      onTimeout: timeoutCallback,
    });
    heartbeatManager.start('conn-1');

    // Simulate missed pings - need to advance time multiple times to trigger timers
    mockClock.advanceTime(1000); // First ping
    mockClock.advanceTime(1000); // Second ping (missed)
    mockClock.advanceTime(1000); // Third ping (missed) - should trigger timeout

    expect(timeoutCallback).toHaveBeenCalledWith('conn-1');
    expect(heartbeatManager.isAlive('conn-1')).toBe(false);
  });

  it('should get heartbeat statistics', () => {
    heartbeatManager.addConnection('conn-1');
    heartbeatManager.addConnection('conn-2');
    heartbeatManager.start('conn-1');

    const stats = heartbeatManager.getStats();
    expect(stats.totalConnections).toBe(2);
    expect(stats.activeConnections).toBe(1);
  });
});

// ============================================================================
// Reconnection Strategy Tests
// ============================================================================

describe('Reconnection Strategies', () => {
  describe('ExponentialBackoff', () => {
    it('should calculate exponential delays', () => {
      const strategy = new ExponentialBackoff(6, 1000, 10000, 2); // Changed maxAttempts to 6

      expect(strategy.shouldReconnect(1)).toBe(true);
      expect(strategy.getDelay(1)).toBe(1000);

      expect(strategy.shouldReconnect(2)).toBe(true);
      expect(strategy.getDelay(2)).toBe(2000);

      expect(strategy.shouldReconnect(3)).toBe(true);
      expect(strategy.getDelay(3)).toBe(4000);

      expect(strategy.shouldReconnect(4)).toBe(true);
      expect(strategy.getDelay(4)).toBe(8000);

      expect(strategy.shouldReconnect(5)).toBe(true);
      expect(strategy.getDelay(5)).toBe(10000); // Capped at max

      expect(strategy.shouldReconnect(6)).toBe(false);
    });
  });

  describe('FixedDelay', () => {
    it('should use fixed delays', () => {
      const strategy = new FixedDelay(4, 5000); // Changed maxAttempts to 4

      expect(strategy.shouldReconnect(1)).toBe(true);
      expect(strategy.getDelay(1)).toBe(5000);

      expect(strategy.shouldReconnect(2)).toBe(true);
      expect(strategy.getDelay(2)).toBe(5000);

      expect(strategy.shouldReconnect(3)).toBe(true);
      expect(strategy.getDelay(3)).toBe(5000);

      expect(strategy.shouldReconnect(4)).toBe(false);
    });
  });
});

// ============================================================================
// Error Tests
// ============================================================================

describe('Realtime Errors', () => {
  it('should create structured errors', () => {
    const error = new ChannelNotFoundError('channel-123');
    
    expect(error).toBeInstanceOf(ChannelError);
    expect(error).toBeInstanceOf(RealtimeError);
    expect(error.code).toBe('CHANNEL_NOT_FOUND');
    expect(error.message).toContain('channel-123');
    expect(error.details).toEqual({ channelId: 'channel-123' });
  });

  it('should serialize to JSON', () => {
    const error = new MessageTooLargeError(2048, 1024);
    const json = error.toJSON();
    
    expect(json.name).toBe('MessageError');
    expect(json.code).toBe('MESSAGE_TOO_LARGE');
    expect(json.details).toEqual({ actualSize: 2048, maxSize: 1024 });
    expect(json.stack).toBeDefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  let mockClock: MockClock;
  let channelManager: ChannelManager;
  let presenceTracker: DefaultPresenceTracker;

  beforeEach(() => {
    mockClock = new MockClock();
    
    // Setup channel manager
    const channelStore = new InMemoryChannelStore();
    const subscriptionStore = new InMemoryChannelSubscriptionStore();
    const historyStore = new InMemoryMessageHistoryStore();
    const authorizer = new DefaultChannelAuthorizer({
      publicChannels: ['*'], // Allow all channels
      requireAuthForSubscribe: false,
      requireAuthForPublish: false,
    });
    
    channelManager = new ChannelManager(
      channelStore,
      subscriptionStore,
      historyStore,
      authorizer,
      undefined,
      mockClock
    );

    // Setup presence tracker
    const presenceStore = new InMemoryPresenceStore();
    presenceTracker = new DefaultPresenceTracker(presenceStore, mockClock);
  });

  it('should handle complete flow: join -> subscribe -> publish -> leave', async () => {
    // Create channel
    const channel = await channelManager.createChannel(
      'room-1',
      ChannelType.ROOM,
      { maxMessageSize: 1024 }
    );

    // User joins presence
    const presence = await presenceTracker.join(
      channel.id,
      'user-1',
      'conn-1'
    );
    expect(presence.status).toBe(PresenceStatus.ONLINE);

    // Subscribe to channel
    const subResult = await channelManager.subscribe('conn-1', channel.id);
    expect(subResult.channel.id).toBe(channel.id);

    // Publish message
    const pubResult = await channelManager.publish(
      channel.id,
      'chat-message',
      { text: 'Hello everyone!' },
      { connectionId: 'conn-1' }
    );
    expect(pubResult.deliveredTo).toBe(1);

    // Update presence
    await presenceTracker.updateStatus(
      channel.id,
      'user-1',
      'conn-1',
      PresenceStatus.AWAY
    );

    // Leave channel
    await channelManager.unsubscribe('conn-1', channel.id);
    await presenceTracker.leave(channel.id, 'user-1', 'conn-1');

    // Verify cleanup
    const subscribers = await channelManager.getSubscribers(channel.id);
    expect(subscribers).toHaveLength(0);

    const presenceAfter = await presenceTracker.get(channel.id, 'user-1');
    expect(presenceAfter).toBeUndefined();
  });

  it('should handle multiple users in a channel', async () => {
    const channel = await channelManager.createChannel(
      'room-1',
      ChannelType.ROOM,
      { maxMessageSize: 1024 }
    );

    // Multiple users join
    const users = ['user-1', 'user-2', 'user-3'];
    for (const userId of users) {
      await presenceTracker.join(channel.id, userId, `conn-${userId}`);
      await channelManager.subscribe(`conn-${userId}`, channel.id);
    }

    // Broadcast message
    const result = await channelManager.publish(
      channel.id,
      'broadcast',
      { message: 'To all users' }
    );
    expect(result.deliveredTo).toBe(3);

    // Check presence stats
    const stats = await presenceTracker.getStats(channel.id);
    expect(stats.totalUsers).toBe(3);
    expect(stats.totalConnections).toBe(3);

    // One user leaves
    await presenceTracker.leave(channel.id, 'user-2', 'conn-user-2');
    await channelManager.unsubscribe('conn-user-2', channel.id);

    // Check updated stats
    const statsAfter = await presenceTracker.getStats(channel.id);
    expect(statsAfter.totalUsers).toBe(2);
    expect(statsAfter.totalConnections).toBe(2);
  });
});
