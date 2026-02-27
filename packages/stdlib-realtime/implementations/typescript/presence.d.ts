import type { Presence, ChannelId, ConnectionId, DeviceInfo } from './types.js';
import { PresenceStatus } from './types.js';
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
export declare class InMemoryPresenceStore implements PresenceStore {
    private presence;
    private channelIndex;
    private userIndex;
    private connectionIndex;
    private makeKey;
    get(channelId: ChannelId, connectionId: ConnectionId): Presence | undefined;
    set(presence: Presence): void;
    delete(channelId: ChannelId, connectionId: ConnectionId): boolean;
    getByChannel(channelId: ChannelId): Presence[];
    getByUser(userId: string): Presence[];
    getByConnection(connectionId: ConnectionId): Presence[];
}
/** Presence manager options */
export interface PresenceManagerOptions {
    store?: PresenceStore;
    staleTimeoutMs?: number;
}
/** Presence manager for tracking user presence */
export declare class PresenceManager {
    private readonly store;
    constructor(options?: PresenceManagerOptions);
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
    }): Presence;
    /**
     * Leave a channel (remove presence)
     */
    leave(channelId: ChannelId, connectionId: ConnectionId): void;
    /**
     * Leave all channels for a connection
     */
    leaveAll(connectionId: ConnectionId): ChannelId[];
    /**
     * Update presence status
     */
    updateStatus(channelId: ChannelId, connectionId: ConnectionId, status: PresenceStatus): Presence;
    /**
     * Update custom state
     */
    updateState(channelId: ChannelId, connectionId: ConnectionId, customState: Record<string, unknown>): Presence;
    /**
     * Touch presence (update last seen)
     */
    touch(channelId: ChannelId, connectionId: ConnectionId): void;
    /**
     * Get presence for a channel
     */
    getChannelPresence(channelId: ChannelId): Presence[];
    /**
     * Get online users in a channel
     */
    getOnlineUsers(channelId: ChannelId): Presence[];
    /**
     * Get presence for a user
     */
    getUserPresence(userId: string): Presence[];
    /**
     * Get presence for a connection
     */
    getConnectionPresence(connectionId: ConnectionId): Presence[];
    /**
     * Get a specific presence entry
     */
    getPresence(channelId: ChannelId, connectionId: ConnectionId): Presence | undefined;
    /**
     * Check if user is in channel
     */
    isUserInChannel(channelId: ChannelId, userId: string): boolean;
    /**
     * Get channel member count
     */
    getMemberCount(channelId: ChannelId): number;
    /**
     * Clean up stale presence entries
     */
    cleanupStale(): Array<{
        channelId: ChannelId;
        connectionId: ConnectionId;
    }>;
}
/**
 * Create a presence entry
 */
export declare function createPresence(params: {
    channelId: ChannelId;
    connectionId: ConnectionId;
    userId: string;
    status?: PresenceStatus;
    customState?: Record<string, unknown>;
    deviceInfo?: DeviceInfo;
}): Presence;
/**
 * Check if a presence is online
 */
export declare function isOnline(presence: Presence): boolean;
/**
 * Check if a presence is visible (not invisible/offline)
 */
export declare function isVisible(presence: Presence): boolean;
/** Presence change event types */
export type PresenceEvent = {
    type: 'joined';
    presence: Presence;
} | {
    type: 'left';
    presence: Presence;
} | {
    type: 'updated';
    presence: Presence;
    changes: Partial<Presence>;
};
/** Presence event listener */
export type PresenceListener = (event: PresenceEvent) => void;
//# sourceMappingURL=presence.d.ts.map