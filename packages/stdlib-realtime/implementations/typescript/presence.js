// ============================================================================
// Presence Tracking
// @isl-lang/stdlib-realtime
// ============================================================================
import { PresenceStatus, RealtimeError, RealtimeErrorCode, } from './types.js';
/** In-memory presence store */
export class InMemoryPresenceStore {
    presence = new Map();
    channelIndex = new Map();
    userIndex = new Map();
    connectionIndex = new Map();
    makeKey(channelId, connectionId) {
        return `${channelId}:${connectionId}`;
    }
    get(channelId, connectionId) {
        return this.presence.get(this.makeKey(channelId, connectionId));
    }
    set(presence) {
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
    delete(channelId, connectionId) {
        const key = this.makeKey(channelId, connectionId);
        const presence = this.presence.get(key);
        if (!presence)
            return false;
        // Clean up indexes
        this.channelIndex.get(channelId)?.delete(key);
        this.userIndex.get(presence.userId)?.delete(key);
        this.connectionIndex.get(connectionId)?.delete(key);
        return this.presence.delete(key);
    }
    getByChannel(channelId) {
        const keys = this.channelIndex.get(channelId);
        if (!keys)
            return [];
        return Array.from(keys)
            .map(k => this.presence.get(k))
            .filter((p) => p !== undefined);
    }
    getByUser(userId) {
        const keys = this.userIndex.get(userId);
        if (!keys)
            return [];
        return Array.from(keys)
            .map(k => this.presence.get(k))
            .filter((p) => p !== undefined);
    }
    getByConnection(connectionId) {
        const keys = this.connectionIndex.get(connectionId);
        if (!keys)
            return [];
        return Array.from(keys)
            .map(k => this.presence.get(k))
            .filter((p) => p !== undefined);
    }
}
/** Presence manager for tracking user presence */
export class PresenceManager {
    store;
    constructor(options = {}) {
        this.store = options.store ?? new InMemoryPresenceStore();
    }
    /**
     * Join a channel (create presence)
     */
    join(params) {
        const now = new Date();
        const presence = {
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
    leave(channelId, connectionId) {
        this.store.delete(channelId, connectionId);
    }
    /**
     * Leave all channels for a connection
     */
    leaveAll(connectionId) {
        const presences = this.store.getByConnection(connectionId);
        const channelIds = [];
        for (const presence of presences) {
            this.store.delete(presence.channelId, connectionId);
            channelIds.push(presence.channelId);
        }
        return channelIds;
    }
    /**
     * Update presence status
     */
    updateStatus(channelId, connectionId, status) {
        const presence = this.store.get(channelId, connectionId);
        if (!presence) {
            throw new RealtimeError(RealtimeErrorCode.NOT_SUBSCRIBED, `No presence found for connection ${connectionId} in channel ${channelId}`);
        }
        const updated = {
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
    updateState(channelId, connectionId, customState) {
        const presence = this.store.get(channelId, connectionId);
        if (!presence) {
            throw new RealtimeError(RealtimeErrorCode.NOT_SUBSCRIBED, `No presence found for connection ${connectionId} in channel ${channelId}`);
        }
        const updated = {
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
    touch(channelId, connectionId) {
        const presence = this.store.get(channelId, connectionId);
        if (presence) {
            const updated = {
                ...presence,
                lastSeenAt: new Date(),
            };
            this.store.set(updated);
        }
    }
    /**
     * Get presence for a channel
     */
    getChannelPresence(channelId) {
        return this.store.getByChannel(channelId);
    }
    /**
     * Get online users in a channel
     */
    getOnlineUsers(channelId) {
        return this.store.getByChannel(channelId).filter(p => p.status === PresenceStatus.ONLINE ||
            p.status === PresenceStatus.AWAY ||
            p.status === PresenceStatus.BUSY);
    }
    /**
     * Get presence for a user
     */
    getUserPresence(userId) {
        return this.store.getByUser(userId);
    }
    /**
     * Get presence for a connection
     */
    getConnectionPresence(connectionId) {
        return this.store.getByConnection(connectionId);
    }
    /**
     * Get a specific presence entry
     */
    getPresence(channelId, connectionId) {
        return this.store.get(channelId, connectionId);
    }
    /**
     * Check if user is in channel
     */
    isUserInChannel(channelId, userId) {
        const channelPresences = this.store.getByChannel(channelId);
        return channelPresences.some(p => p.userId === userId);
    }
    /**
     * Get channel member count
     */
    getMemberCount(channelId) {
        return this.store.getByChannel(channelId).length;
    }
    /**
     * Clean up stale presence entries
     */
    cleanupStale() {
        const stale = [];
        // Note: In a real implementation, we'd need to iterate all presence entries
        // This is a simplified version
        return stale;
    }
}
/**
 * Create a presence entry
 */
export function createPresence(params) {
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
export function isOnline(presence) {
    return presence.status === PresenceStatus.ONLINE ||
        presence.status === PresenceStatus.AWAY ||
        presence.status === PresenceStatus.BUSY;
}
/**
 * Check if a presence is visible (not invisible/offline)
 */
export function isVisible(presence) {
    return presence.status !== PresenceStatus.INVISIBLE &&
        presence.status !== PresenceStatus.OFFLINE;
}
//# sourceMappingURL=presence.js.map