import type { Message, ChannelId, ConnectionId } from './types.js';
import { SenderType, MessageType, Priority } from './types.js';
/**
 * Create a new message
 */
export declare function createMessage<TData = unknown>(params: {
    channelId: ChannelId;
    event: string;
    data: TData;
    senderId?: ConnectionId;
    senderType?: SenderType;
    type?: MessageType;
    priority?: Priority;
    ttlMs?: number;
}): Message<TData>;
/**
 * Create a system message
 */
export declare function createSystemMessage<TData = unknown>(channelId: ChannelId, event: string, data: TData): Message<TData>;
/**
 * Create a ping message
 */
export declare function createPingMessage(connectionId: ConnectionId): Message<null>;
/**
 * Create a pong message
 */
export declare function createPongMessage(connectionId: ConnectionId): Message<null>;
/**
 * Create a close message
 */
export declare function createCloseMessage(connectionId: ConnectionId, code?: number, reason?: string): Message<{
    code?: number;
    reason?: string;
}>;
/**
 * Check if a message is expired
 */
export declare function isMessageExpired(message: Message): boolean;
/**
 * Check if a message is a system message
 */
export declare function isSystemMessage(message: Message): boolean;
/**
 * Check if a message is a control message (ping/pong/close)
 */
export declare function isControlMessage(message: Message): boolean;
/**
 * Serialize a message to JSON
 */
export declare function serializeMessage(message: Message): string;
/**
 * Deserialize a message from JSON
 */
export declare function deserializeMessage<TData = unknown>(json: string): Message<TData> | null;
/**
 * Get message size in bytes
 */
export declare function getMessageSize(message: Message): number;
/**
 * Validate message size against channel limit
 */
export declare function validateMessageSize(message: Message, maxSize: number): void;
/** Message queue for ordered delivery */
export declare class MessageQueue {
    private queue;
    private processing;
    /**
     * Add a message to the queue
     */
    enqueue(message: Message): void;
    /**
     * Get the next message from the queue
     */
    dequeue(): Message | undefined;
    /**
     * Peek at the next message without removing it
     */
    peek(): Message | undefined;
    /**
     * Check if the queue is empty
     */
    isEmpty(): boolean;
    /**
     * Get the queue size
     */
    size(): number;
    /**
     * Clear the queue
     */
    clear(): void;
    /**
     * Process all messages with a handler
     */
    processAll(handler: (message: Message) => Promise<void>): Promise<number>;
    private comparePriority;
}
/** Rate limiter for message publishing */
export declare class MessageRateLimiter {
    private readonly messagesPerSecond;
    private readonly burst;
    private tokens;
    private lastRefill;
    constructor(messagesPerSecond: number, burst?: number);
    /**
     * Try to acquire a token for sending a message
     */
    tryAcquire(): boolean;
    /**
     * Get remaining tokens
     */
    getTokens(): number;
    /**
     * Get time until next token is available (in ms)
     */
    getRetryAfter(): number;
    private refill;
}
//# sourceMappingURL=message.d.ts.map