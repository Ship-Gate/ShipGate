// ============================================================================
// Message Handling
// @isl-lang/stdlib-realtime
// ============================================================================
import { SenderType, MessageType, Priority, DeliveryStatus, RealtimeError, RealtimeErrorCode, } from './types.js';
/**
 * Create a new message
 */
export function createMessage(params) {
    return {
        id: globalThis.crypto.randomUUID(),
        channelId: params.channelId,
        senderId: params.senderId,
        senderType: params.senderType ?? (params.senderId ? SenderType.CLIENT : SenderType.SERVER),
        type: params.type ?? MessageType.JSON,
        event: params.event,
        data: params.data,
        timestamp: new Date(),
        priority: params.priority ?? Priority.NORMAL,
        ttlMs: params.ttlMs,
        deliveryStatus: DeliveryStatus.PENDING,
    };
}
/**
 * Create a system message
 */
export function createSystemMessage(channelId, event, data) {
    return createMessage({
        channelId,
        event,
        data,
        senderType: SenderType.SYSTEM,
        type: MessageType.EVENT,
    });
}
/**
 * Create a ping message
 */
export function createPingMessage(connectionId) {
    return {
        id: globalThis.crypto.randomUUID(),
        channelId: '__system__',
        senderId: connectionId,
        senderType: SenderType.SYSTEM,
        type: MessageType.PING,
        event: 'ping',
        data: null,
        timestamp: new Date(),
        priority: Priority.HIGH,
    };
}
/**
 * Create a pong message
 */
export function createPongMessage(connectionId) {
    return {
        id: globalThis.crypto.randomUUID(),
        channelId: '__system__',
        senderId: connectionId,
        senderType: SenderType.SYSTEM,
        type: MessageType.PONG,
        event: 'pong',
        data: null,
        timestamp: new Date(),
        priority: Priority.HIGH,
    };
}
/**
 * Create a close message
 */
export function createCloseMessage(connectionId, code, reason) {
    return {
        id: globalThis.crypto.randomUUID(),
        channelId: '__system__',
        senderId: connectionId,
        senderType: SenderType.SYSTEM,
        type: MessageType.CLOSE,
        event: 'close',
        data: { code, reason },
        timestamp: new Date(),
        priority: Priority.HIGH,
    };
}
/**
 * Check if a message is expired
 */
export function isMessageExpired(message) {
    if (!message.ttlMs)
        return false;
    const age = Date.now() - message.timestamp.getTime();
    return age > message.ttlMs;
}
/**
 * Check if a message is a system message
 */
export function isSystemMessage(message) {
    return message.senderType === SenderType.SYSTEM;
}
/**
 * Check if a message is a control message (ping/pong/close)
 */
export function isControlMessage(message) {
    return (message.type === MessageType.PING ||
        message.type === MessageType.PONG ||
        message.type === MessageType.CLOSE);
}
/**
 * Serialize a message to JSON
 */
export function serializeMessage(message) {
    return JSON.stringify({
        id: message.id,
        channelId: message.channelId,
        event: message.event,
        data: message.data,
        timestamp: message.timestamp.toISOString(),
        type: message.type,
        priority: message.priority,
    });
}
/**
 * Deserialize a message from JSON
 */
export function deserializeMessage(json) {
    try {
        const parsed = JSON.parse(json);
        return {
            id: parsed.id,
            channelId: parsed.channelId,
            senderId: parsed.senderId,
            senderType: parsed.senderType ?? SenderType.CLIENT,
            type: parsed.type ?? MessageType.JSON,
            event: parsed.event,
            data: parsed.data,
            timestamp: new Date(parsed.timestamp),
            priority: parsed.priority ?? Priority.NORMAL,
            ttlMs: parsed.ttlMs,
        };
    }
    catch {
        return null;
    }
}
/**
 * Get message size in bytes
 */
export function getMessageSize(message) {
    return new TextEncoder().encode(serializeMessage(message)).length;
}
/**
 * Validate message size against channel limit
 */
export function validateMessageSize(message, maxSize) {
    const size = getMessageSize(message);
    if (size > maxSize) {
        throw new RealtimeError(RealtimeErrorCode.MESSAGE_TOO_LARGE, `Message size ${size} exceeds maximum ${maxSize}`, { maxSize, actualSize: size });
    }
}
/** Message queue for ordered delivery */
export class MessageQueue {
    queue = [];
    processing = false;
    /**
     * Add a message to the queue
     */
    enqueue(message) {
        // Insert based on priority
        const insertIndex = this.queue.findIndex(m => this.comparePriority(message.priority, m.priority) > 0);
        if (insertIndex === -1) {
            this.queue.push(message);
        }
        else {
            this.queue.splice(insertIndex, 0, message);
        }
    }
    /**
     * Get the next message from the queue
     */
    dequeue() {
        return this.queue.shift();
    }
    /**
     * Peek at the next message without removing it
     */
    peek() {
        return this.queue[0];
    }
    /**
     * Check if the queue is empty
     */
    isEmpty() {
        return this.queue.length === 0;
    }
    /**
     * Get the queue size
     */
    size() {
        return this.queue.length;
    }
    /**
     * Clear the queue
     */
    clear() {
        this.queue = [];
    }
    /**
     * Process all messages with a handler
     */
    async processAll(handler) {
        if (this.processing)
            return 0;
        this.processing = true;
        let processed = 0;
        try {
            while (!this.isEmpty()) {
                const message = this.dequeue();
                if (message && !isMessageExpired(message)) {
                    await handler(message);
                    processed++;
                }
            }
        }
        finally {
            this.processing = false;
        }
        return processed;
    }
    comparePriority(a, b) {
        const order = {
            [Priority.CRITICAL]: 4,
            [Priority.HIGH]: 3,
            [Priority.NORMAL]: 2,
            [Priority.LOW]: 1,
        };
        return order[a] - order[b];
    }
}
/** Rate limiter for message publishing */
export class MessageRateLimiter {
    messagesPerSecond;
    burst;
    tokens;
    lastRefill;
    constructor(messagesPerSecond, burst) {
        this.messagesPerSecond = messagesPerSecond;
        this.burst = burst ?? messagesPerSecond;
        this.tokens = this.burst;
        this.lastRefill = Date.now();
    }
    /**
     * Try to acquire a token for sending a message
     */
    tryAcquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }
    /**
     * Get remaining tokens
     */
    getTokens() {
        this.refill();
        return this.tokens;
    }
    /**
     * Get time until next token is available (in ms)
     */
    getRetryAfter() {
        if (this.tokens >= 1)
            return 0;
        const tokensNeeded = 1 - this.tokens;
        return Math.ceil((tokensNeeded / this.messagesPerSecond) * 1000);
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.messagesPerSecond;
        this.tokens = Math.min(this.burst, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
}
//# sourceMappingURL=message.js.map