/**
 * Channel implementation for pub/sub communication
 * @packageDocumentation
 */

import type {
  ChannelId,
  ChannelType,
  ChannelConfig,
  Message,
  MessageId,
  ConnectionId,
  Clock,
  DefaultClock,
} from '../types.js';
import type { Channel, ChannelSubscription } from './types.js';
import { ChannelError, ChannelNotFoundError, ChannelExistsError } from '../errors.js';

// ============================================================================
// Channel Implementation
// ============================================================================

export class ChannelImpl implements Channel {
  public subscriberCount: number = 0;
  public readonly createdAt: Date;

  constructor(
    public readonly id: ChannelId,
    public readonly name: string,
    public readonly type: ChannelType,
    public readonly config: ChannelConfig,
    options?: {
      historyEnabled?: boolean;
      historySize?: number;
      historyTtl?: number;
      public?: boolean;
      allowedPublishers?: string[];
      allowedSubscribers?: string[];
      createdAt?: Date;
    }
  ) {
    this.createdAt = options?.createdAt || new Date();
    this.historyEnabled = options?.historyEnabled;
    this.historySize = options?.historySize;
    this.historyTtl = options?.historyTtl;
    this.public = options?.public ?? true;
    this.allowedPublishers = options?.allowedPublishers;
    this.allowedSubscribers = options?.allowedSubscribers;
  }

  public historyEnabled?: boolean;
  public historySize?: number;
  public historyTtl?: number;
  public public?: boolean;
  public allowedPublishers?: string[];
  public allowedSubscribers?: string[];

  // ============================================================================
  // Validation Methods
  // ============================================================================

  validateMessage(message: Message): void {
    // Check message size
    if (this.config.maxMessageSize) {
      const size = this.getMessageSize(message);
      if (size > this.config.maxMessageSize) {
        throw new ChannelError('MESSAGE_TOO_LARGE', 
          `Message size ${size} exceeds maximum ${this.config.maxMessageSize}`,
          { actualSize: size, maxSize: this.config.maxMessageSize }
        );
      }
    }

    // Check if sender is allowed to publish
    if (!this.canPublish(message.senderId)) {
      throw new ChannelError('PUBLISH_NOT_ALLOWED', 
        'Sender is not allowed to publish to this channel',
        { senderId: message.senderId, channelId: this.id }
      );
    }
  }

  canPublish(senderId?: ConnectionId): boolean {
    if (!this.allowedPublishers || this.allowedPublishers.length === 0) {
      return true;
    }

    if (!senderId) {
      // Server-side publish
      return true;
    }

    return this.allowedPublishers.includes(senderId);
  }

  canSubscribe(connectionId: ConnectionId): boolean {
    if (this.public) {
      return true;
    }

    if (!this.allowedSubscribers || this.allowedSubscribers.length === 0) {
      return true;
    }

    return this.allowedSubscribers.includes(connectionId);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getMessageSize(message: Message): number {
    let size = 0;
    
    // Add size of basic fields
    size += message.id.length;
    size += message.channelId.length;
    size += message.event.length;
    size += message.type.length;
    
    // Add size of data
    if (message.data) {
      if (typeof message.data === 'string') {
        size += message.data.length;
      } else if (message.data instanceof ArrayBuffer) {
        size += message.data.byteLength;
      } else {
        // JSON serialization
        size += JSON.stringify(message.data).length;
      }
    }
    
    return size;
  }

  toJSON(): Channel {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      config: this.config,
      subscriberCount: this.subscriberCount,
      createdAt: this.createdAt,
      historyEnabled: this.historyEnabled,
      historySize: this.historySize,
      historyTtl: this.historyTtl,
      public: this.public,
      allowedPublishers: this.allowedPublishers,
      allowedSubscribers: this.allowedSubscribers,
    };
  }
}

// ============================================================================
// Channel Subscription Implementation
// ============================================================================

export class ChannelSubscriptionImpl implements ChannelSubscription {
  public readonly subscribedAt: Date;

  constructor(
    public readonly connectionId: ConnectionId,
    public readonly channelId: ChannelId,
    public readonly userId?: string,
    public readonly permissions: string[] = [],
    public readonly metadata?: Record<string, any>,
    subscribedAt?: Date
  ) {
    this.subscribedAt = subscribedAt || new Date();
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  toJSON(): ChannelSubscription {
    return {
      connectionId: this.connectionId,
      channelId: this.channelId,
      userId: this.userId,
      subscribedAt: this.subscribedAt,
      permissions: this.permissions,
      metadata: this.metadata,
    };
  }
}

// ============================================================================
// Channel Factory
// ============================================================================

export class ChannelFactory {
  static create(
    id: ChannelId,
    name: string,
    type: ChannelType,
    config: ChannelConfig,
    options?: {
      historyEnabled?: boolean;
      historySize?: number;
      historyTtl?: number;
      public?: boolean;
      allowedPublishers?: string[];
      allowedSubscribers?: string[];
    }
  ): Channel {
    return new ChannelImpl(id, name, type, config, options);
  }

  static createBroadcast(
    id: ChannelId,
    name: string,
    options?: Partial<ChannelConfig> & {
      historyEnabled?: boolean;
      historySize?: number;
    }
  ): Channel {
    const config: ChannelConfig = {
      maxMessageSize: 65536,
      requireAuth: false,
      encryption: false,
      ...options,
    };

    return new ChannelImpl(id, name, ChannelType.BROADCAST, config, {
      historyEnabled: options?.historyEnabled ?? false,
      historySize: options?.historySize,
      public: true,
    });
  }

  static createPresence(
    id: ChannelId,
    name: string,
    options?: Partial<ChannelConfig> & {
      historyTtl?: number;
    }
  ): Channel {
    const config: ChannelConfig = {
      maxMessageSize: 65536,
      requireAuth: true,
      encryption: false,
      ...options,
    };

    return new ChannelImpl(id, name, ChannelType.PRESENCE, config, {
      historyEnabled: true,
      historySize: 100, // Keep last 100 presence events
      historyTtl: options?.historyTtl || 3600000, // 1 hour default
      public: false,
    });
  }

  static createDirect(
    id: ChannelId,
    participant1: ConnectionId,
    participant2: ConnectionId,
    options?: Partial<ChannelConfig>
  ): Channel {
    const config: ChannelConfig = {
      maxMessageSize: 65536,
      requireAuth: true,
      encryption: true,
      ...options,
    };

    return new ChannelImpl(id, `direct:${participant1}:${participant2}`, ChannelType.DIRECT, config, {
      public: false,
      allowedSubscribers: [participant1, participant2],
      allowedPublishers: [participant1, participant2],
    });
  }

  static createRoom(
    id: ChannelId,
    name: string,
    options?: Partial<ChannelConfig> & {
      maxSubscribers?: number;
      public?: boolean;
    }
  ): Channel {
    const config: ChannelConfig = {
      maxMessageSize: 65536,
      requireAuth: true,
      encryption: false,
      maxSubscribers: options?.maxSubscribers || 100,
      ...options,
    };

    return new ChannelImpl(id, name, ChannelType.ROOM, config, {
      historyEnabled: true,
      historySize: 1000,
      public: options?.public ?? false,
    });
  }

  static createFanout(
    id: ChannelId,
    name: string,
    options?: Partial<ChannelConfig>
  ): Channel {
    const config: ChannelConfig = {
      maxMessageSize: 65536,
      requireAuth: false,
      encryption: false,
      ...options,
    };

    return new ChannelImpl(id, name, ChannelType.FANOUT, config, {
      public: true,
    });
  }
}

// ============================================================================
// Default Channel Configurations
// ============================================================================

export const DefaultChannelConfigs = {
  broadcast: {
    maxMessageSize: 65536,
    requireAuth: false,
    encryption: false,
  } as ChannelConfig,

  presence: {
    maxMessageSize: 4096,
    requireAuth: true,
    encryption: false,
    rateLimit: {
      messagesPerSecond: 10,
      burst: 20,
    },
  } as ChannelConfig,

  direct: {
    maxMessageSize: 65536,
    requireAuth: true,
    encryption: true,
  } as ChannelConfig,

  room: {
    maxMessageSize: 65536,
    requireAuth: true,
    encryption: false,
    rateLimit: {
      messagesPerSecond: 100,
      burst: 200,
    },
  } as ChannelConfig,

  fanout: {
    maxMessageSize: 65536,
    requireAuth: false,
    encryption: false,
    rateLimit: {
      messagesPerSecond: 1000,
      burst: 2000,
    },
  } as ChannelConfig,
};
