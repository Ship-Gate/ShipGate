/**
 * Queue Implementation
 * 
 * In-memory message queue with visibility timeout and dead-letter support.
 */

import { randomUUID } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type MessageId = string;
export type QueueName = string;
export type TopicName = string;

export type DeliveryStatus = 
  | 'PENDING'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'DEAD_LETTERED';

export type QueueType = 'STANDARD' | 'FIFO' | 'PRIORITY' | 'DELAY';
export type AcknowledgeMode = 'AUTO' | 'MANUAL' | 'TRANSACTIONAL';

export interface Message {
  id: MessageId;
  topic: TopicName;
  queue?: QueueName;
  partitionKey?: string;
  payload: string;
  contentType: string;
  headers: Map<string, string>;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  createdAt: Date;
  scheduledAt?: Date;
  deliveredAt?: Date;
  acknowledgedAt?: Date;
  expiresAt?: Date;
  status: DeliveryStatus;
  retryCount: number;
  maxRetries: number;
  visibilityTimeout?: number;
  visibleAt?: Date;
  deadLetterReason?: string;
  deadLetterAt?: Date;
  originalQueue?: QueueName;
}

export interface Queue {
  name: QueueName;
  type: QueueType;
  acknowledgeMode: AcknowledgeMode;
  maxSize?: number;
  maxMessageSize: number;
  defaultVisibilityTimeout: number;
  messageRetention: number;
  delaySeconds: number;
  deadLetterQueue?: QueueName;
  maxReceiveCount: number;
  createdAt: Date;
  updatedAt: Date;
  tags: Map<string, string>;
}

export interface QueueStats {
  messageCount: number;
  inFlightCount: number;
  oldestMessageAge?: number;
  approximateDelay?: number;
}

// ============================================================================
// ERRORS
// ============================================================================

export class QueueError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'QueueError';
  }
}

// ============================================================================
// QUEUE STORE
// ============================================================================

export class QueueStore {
  private queues: Map<QueueName, Queue> = new Map();
  private messages: Map<QueueName, Message[]> = new Map();
  private messageIndex: Map<MessageId, Message> = new Map();
  private inFlight: Map<QueueName, Set<MessageId>> = new Map();

  // ==========================================================================
  // QUEUE OPERATIONS
  // ==========================================================================

  createQueue(config: {
    name: QueueName;
    type?: QueueType;
    acknowledgeMode?: AcknowledgeMode;
    deadLetterQueue?: QueueName;
    maxReceiveCount?: number;
    defaultVisibilityTimeout?: number;
    messageRetention?: number;
    delaySeconds?: number;
    maxSize?: number;
    tags?: Map<string, string>;
  }): Queue {
    if (this.queues.has(config.name)) {
      throw new QueueError('QUEUE_ALREADY_EXISTS', `Queue ${config.name} already exists`);
    }

    if (config.deadLetterQueue && !this.queues.has(config.deadLetterQueue)) {
      throw new QueueError('INVALID_DEAD_LETTER_QUEUE', `Dead letter queue ${config.deadLetterQueue} does not exist`);
    }

    const queue: Queue = {
      name: config.name,
      type: config.type ?? 'STANDARD',
      acknowledgeMode: config.acknowledgeMode ?? 'MANUAL',
      maxSize: config.maxSize,
      maxMessageSize: 262144,
      defaultVisibilityTimeout: config.defaultVisibilityTimeout ?? 30000,
      messageRetention: config.messageRetention ?? 14 * 24 * 60 * 60 * 1000,
      delaySeconds: config.delaySeconds ?? 0,
      deadLetterQueue: config.deadLetterQueue,
      maxReceiveCount: config.maxReceiveCount ?? 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: config.tags ?? new Map(),
    };

    this.queues.set(config.name, queue);
    this.messages.set(config.name, []);
    this.inFlight.set(config.name, new Set());

    return queue;
  }

  getQueue(name: QueueName): Queue | undefined {
    return this.queues.get(name);
  }

  deleteQueue(name: QueueName, force: boolean = false): boolean {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${name} does not exist`);
    }

    const messages = this.messages.get(name) ?? [];
    if (messages.length > 0 && !force) {
      throw new QueueError('QUEUE_NOT_EMPTY', `Queue ${name} contains ${messages.length} messages`);
    }

    // Clean up messages
    for (const msg of messages) {
      this.messageIndex.delete(msg.id);
    }

    this.queues.delete(name);
    this.messages.delete(name);
    this.inFlight.delete(name);

    return true;
  }

  purgeQueue(name: QueueName): number {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${name} does not exist`);
    }

    const messages = this.messages.get(name) ?? [];
    const count = messages.length;

    for (const msg of messages) {
      this.messageIndex.delete(msg.id);
    }

    this.messages.set(name, []);
    this.inFlight.set(name, new Set());

    return count;
  }

  getQueueStats(name: QueueName): QueueStats {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${name} does not exist`);
    }

    const messages = this.messages.get(name) ?? [];
    const inFlightSet = this.inFlight.get(name) ?? new Set();
    
    const visibleMessages = messages.filter(m => 
      m.status === 'PENDING' && 
      (!m.visibleAt || m.visibleAt <= new Date())
    );

    let oldestMessageAge: number | undefined;
    if (visibleMessages.length > 0) {
      const oldest = visibleMessages.reduce((a, b) => 
        a.createdAt < b.createdAt ? a : b
      );
      oldestMessageAge = Date.now() - oldest.createdAt.getTime();
    }

    return {
      messageCount: messages.filter(m => m.status === 'PENDING' || m.status === 'DELIVERED').length,
      inFlightCount: inFlightSet.size,
      oldestMessageAge,
      approximateDelay: queue.delaySeconds * 1000,
    };
  }

  // ==========================================================================
  // MESSAGE OPERATIONS
  // ==========================================================================

  enqueue(queueName: QueueName, message: Omit<Message, 'queue'>): Message {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${queueName} does not exist`);
    }

    const messages = this.messages.get(queueName)!;
    
    if (queue.maxSize && messages.length >= queue.maxSize) {
      throw new QueueError('QUEUE_FULL', `Queue ${queueName} is at capacity`);
    }

    const queuedMessage: Message = {
      ...message,
      queue: queueName,
      visibleAt: queue.delaySeconds > 0 
        ? new Date(Date.now() + queue.delaySeconds * 1000)
        : undefined,
    };

    messages.push(queuedMessage);
    this.messageIndex.set(queuedMessage.id, queuedMessage);

    // Sort by priority if PRIORITY queue
    if (queue.type === 'PRIORITY') {
      messages.sort((a, b) => {
        const priorityA = parseInt(a.headers.get('priority') ?? '0');
        const priorityB = parseInt(b.headers.get('priority') ?? '0');
        return priorityB - priorityA;
      });
    }

    return queuedMessage;
  }

  consume(
    queueName: QueueName,
    maxMessages: number = 10,
    visibilityTimeout: number = 30000
  ): Message[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${queueName} does not exist`);
    }

    const messages = this.messages.get(queueName)!;
    const inFlightSet = this.inFlight.get(queueName)!;
    const now = new Date();
    const result: Message[] = [];

    for (const msg of messages) {
      if (result.length >= maxMessages) break;

      // Skip if already in flight
      if (inFlightSet.has(msg.id)) continue;

      // Skip if not visible yet
      if (msg.visibleAt && msg.visibleAt > now) continue;

      // Skip if not pending
      if (msg.status !== 'PENDING') continue;

      // Skip if expired
      if (msg.expiresAt && msg.expiresAt <= now) continue;

      // Deliver message
      msg.status = 'DELIVERED';
      msg.deliveredAt = now;
      msg.retryCount++;
      msg.visibilityTimeout = visibilityTimeout;
      msg.visibleAt = new Date(now.getTime() + visibilityTimeout);

      inFlightSet.add(msg.id);
      result.push(msg);

      // Check if should dead-letter
      if (msg.retryCount > queue.maxReceiveCount) {
        this.deadLetter(msg.id, 'Max receive count exceeded');
        inFlightSet.delete(msg.id);
        result.pop();
      }
    }

    return result;
  }

  peek(queueName: QueueName, maxMessages: number = 10): Message[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueError('QUEUE_NOT_FOUND', `Queue ${queueName} does not exist`);
    }

    const messages = this.messages.get(queueName)!;
    const now = new Date();
    const result: Message[] = [];

    for (const msg of messages) {
      if (result.length >= maxMessages) break;

      if (msg.status === 'PENDING' && (!msg.visibleAt || msg.visibleAt <= now)) {
        result.push({ ...msg });
      }
    }

    return result;
  }

  acknowledge(messageId: MessageId): boolean {
    const message = this.messageIndex.get(messageId);
    if (!message) {
      throw new QueueError('MESSAGE_NOT_FOUND', `Message ${messageId} does not exist`);
    }

    if (message.status !== 'DELIVERED') {
      throw new QueueError('MESSAGE_NOT_DELIVERED', `Message ${messageId} is not in delivered state`);
    }

    if (message.acknowledgedAt) {
      throw new QueueError('ALREADY_ACKNOWLEDGED', `Message ${messageId} already acknowledged`);
    }

    // Check visibility timeout
    if (message.visibleAt && message.visibleAt <= new Date()) {
      throw new QueueError('VISIBILITY_EXPIRED', `Message ${messageId} visibility has expired`);
    }

    message.status = 'ACKNOWLEDGED';
    message.acknowledgedAt = new Date();

    // Remove from in-flight
    if (message.queue) {
      this.inFlight.get(message.queue)?.delete(messageId);
    }

    return true;
  }

  reject(messageId: MessageId, delay: number = 0): Message {
    const message = this.messageIndex.get(messageId);
    if (!message) {
      throw new QueueError('MESSAGE_NOT_FOUND', `Message ${messageId} does not exist`);
    }

    if (message.status !== 'DELIVERED') {
      throw new QueueError('MESSAGE_NOT_DELIVERED', `Message ${messageId} is not in delivered state`);
    }

    const queue = message.queue ? this.queues.get(message.queue) : undefined;
    
    // Check if should dead-letter
    if (queue && message.retryCount >= queue.maxReceiveCount) {
      return this.deadLetter(messageId, 'Max receive count exceeded');
    }

    message.status = 'PENDING';
    message.visibleAt = new Date(Date.now() + delay);

    // Remove from in-flight
    if (message.queue) {
      this.inFlight.get(message.queue)?.delete(messageId);
    }

    return message;
  }

  deadLetter(messageId: MessageId, reason: string): Message {
    const message = this.messageIndex.get(messageId);
    if (!message) {
      throw new QueueError('MESSAGE_NOT_FOUND', `Message ${messageId} does not exist`);
    }

    if (message.status === 'DEAD_LETTERED') {
      throw new QueueError('ALREADY_DEAD_LETTERED', `Message ${messageId} already dead-lettered`);
    }

    const originalQueue = message.queue;
    const queue = originalQueue ? this.queues.get(originalQueue) : undefined;

    message.status = 'DEAD_LETTERED';
    message.deadLetterAt = new Date();
    message.deadLetterReason = reason;
    message.originalQueue = originalQueue;

    // Remove from original queue
    if (originalQueue) {
      this.inFlight.get(originalQueue)?.delete(messageId);
      const messages = this.messages.get(originalQueue);
      if (messages) {
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx >= 0) messages.splice(idx, 1);
      }
    }

    // Move to DLQ if configured
    if (queue?.deadLetterQueue) {
      message.queue = queue.deadLetterQueue;
      this.messages.get(queue.deadLetterQueue)?.push(message);
    }

    return message;
  }

  changeVisibility(messageId: MessageId, visibilityTimeout: number): Message {
    const message = this.messageIndex.get(messageId);
    if (!message) {
      throw new QueueError('MESSAGE_NOT_FOUND', `Message ${messageId} does not exist`);
    }

    if (message.status !== 'DELIVERED') {
      throw new QueueError('MESSAGE_NOT_IN_FLIGHT', `Message ${messageId} is not in flight`);
    }

    message.visibilityTimeout = visibilityTimeout;
    message.visibleAt = visibilityTimeout === 0 
      ? new Date() 
      : new Date(Date.now() + visibilityTimeout);

    return message;
  }

  getMessage(messageId: MessageId): Message | undefined {
    return this.messageIndex.get(messageId);
  }

  // ==========================================================================
  // VISIBILITY TIMEOUT PROCESSOR
  // ==========================================================================

  processVisibilityTimeouts(): void {
    const now = new Date();

    for (const [, inFlightSet] of this.inFlight) {
      for (const messageId of inFlightSet) {
        const message = this.messageIndex.get(messageId);
        if (message && message.visibleAt && message.visibleAt <= now) {
          // Return to queue
          message.status = 'PENDING';
          inFlightSet.delete(messageId);
        }
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const queueStore = new QueueStore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createMessage(config: {
  topic: TopicName;
  payload: string;
  contentType?: string;
  headers?: Map<string, string>;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  scheduledAt?: Date;
  expiresAt?: Date;
  maxRetries?: number;
}): Message {
  return {
    id: randomUUID(),
    topic: config.topic,
    payload: config.payload,
    contentType: config.contentType ?? 'application/json',
    headers: config.headers ?? new Map(),
    correlationId: config.correlationId,
    causationId: config.causationId,
    idempotencyKey: config.idempotencyKey,
    createdAt: new Date(),
    scheduledAt: config.scheduledAt,
    expiresAt: config.expiresAt,
    status: 'PENDING',
    retryCount: 0,
    maxRetries: config.maxRetries ?? 10,
  };
}
