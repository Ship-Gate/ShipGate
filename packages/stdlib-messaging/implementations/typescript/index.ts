/**
 * @isl-lang/stdlib-messaging
 * 
 * ISL Standard Library - Messaging
 * Provides messaging primitives: queues, topics, pub/sub patterns.
 */

// ============================================================================
// QUEUE EXPORTS
// ============================================================================

export {
  // Types
  type MessageId,
  type QueueName,
  type TopicName,
  type DeliveryStatus,
  type QueueType,
  type AcknowledgeMode,
  type Message,
  type Queue,
  type QueueStats,
  
  // Classes
  QueueStore,
  QueueError,
  
  // Store instance
  queueStore,
  
  // Helpers
  createMessage,
} from './queue.js';

// ============================================================================
// PUB/SUB EXPORTS
// ============================================================================

export {
  // Types
  type SubscriptionId,
  type FilterExpression,
  type Topic,
  type DeliveryPolicy,
  type BackoffPolicy,
  type Subscription,
  type TopicStats,
  type PublishResult,
  type BatchPublishResult,
  
  // Classes
  PubSubStore,
  PubSubError,
  
  // Store instance
  pubSubStore,
  
  // Behavior functions
  publish,
  subscribe,
  unsubscribe,
  createTopic,
  deleteTopic,
} from './pubsub.js';

// ============================================================================
// BEHAVIOR IMPLEMENTATIONS
// ============================================================================

import { queueStore, type Message } from './queue.js';
import { pubSubStore } from './pubsub.js';

/**
 * Publish a message to a topic
 */
export async function Publish(input: {
  topic: string;
  payload: string;
  contentType?: string;
  headers?: Record<string, string>;
  partitionKey?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  delay?: number;
  scheduledAt?: Date;
  expiresAt?: Date;
}): Promise<{ success: true; data: Message } | { success: false; error: string; code: string }> {
  try {
    const result = pubSubStore.publish({
      topic: input.topic,
      payload: input.payload,
      contentType: input.contentType,
      headers: input.headers ? new Map(Object.entries(input.headers)) : undefined,
      partitionKey: input.partitionKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      idempotencyKey: input.idempotencyKey,
      delay: input.delay,
      scheduledAt: input.scheduledAt,
      expiresAt: input.expiresAt,
    });
    return { success: true, data: result.message };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Subscribe a queue to a topic
 */
export async function Subscribe(input: {
  topic: string;
  queue: string;
  filter?: string;
  rawMessageDelivery?: boolean;
  enableBatching?: boolean;
  batchSize?: number;
  batchWindow?: number;
}): Promise<{ success: true; data: { id: string; topic: string; queue: string } } | { success: false; error: string; code: string }> {
  try {
    const result = pubSubStore.subscribe({
      topic: input.topic,
      queue: input.queue,
      filter: input.filter,
      rawMessageDelivery: input.rawMessageDelivery,
      enableBatching: input.enableBatching,
      batchSize: input.batchSize,
      batchWindow: input.batchWindow,
    });
    return { 
      success: true, 
      data: { id: result.id, topic: result.topic, queue: result.queue } 
    };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Consume messages from a queue
 */
export async function Consume(input: {
  queue: string;
  maxMessages?: number;
  visibilityTimeout?: number;
  waitTime?: number;
}): Promise<{ success: true; data: Message[] } | { success: false; error: string; code: string }> {
  try {
    // Long polling simulation
    const waitTime = input.waitTime ?? 0;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 20000)));
    }
    
    const messages = queueStore.consume(
      input.queue,
      input.maxMessages ?? 10,
      input.visibilityTimeout ?? 30000
    );
    return { success: true, data: messages };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Acknowledge a message
 */
export async function Acknowledge(input: {
  messageId: string;
}): Promise<{ success: true; data: boolean } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.acknowledge(input.messageId);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Acknowledge multiple messages
 */
export async function AcknowledgeBatch(input: {
  messageIds: string[];
}): Promise<{ 
  success: true; 
  data: { successful: string[]; failed: Array<{ messageId: string; error: string }> } 
} | { success: false; error: string; code: string }> {
  const successful: string[] = [];
  const failed: Array<{ messageId: string; error: string }> = [];

  for (const messageId of input.messageIds) {
    try {
      queueStore.acknowledge(messageId);
      successful.push(messageId);
    } catch (error) {
      failed.push({
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { success: true, data: { successful, failed } };
}

/**
 * Reject a message
 */
export async function Reject(input: {
  messageId: string;
  delay?: number;
  reason?: string;
}): Promise<{ success: true; data: Message } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.reject(input.messageId, input.delay ?? 0);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Dead-letter a message
 */
export async function DeadLetter(input: {
  messageId: string;
  reason: string;
}): Promise<{ success: true; data: Message } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.deadLetter(input.messageId, input.reason);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Create a queue
 */
export async function CreateQueue(input: {
  name: string;
  type?: 'STANDARD' | 'FIFO' | 'PRIORITY' | 'DELAY';
  acknowledgeMode?: 'AUTO' | 'MANUAL' | 'TRANSACTIONAL';
  deadLetterQueue?: string;
  maxReceiveCount?: number;
  defaultVisibilityTimeout?: number;
  messageRetention?: number;
  delaySeconds?: number;
  maxSize?: number;
  tags?: Record<string, string>;
}): Promise<{ success: true; data: { name: string } } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.createQueue({
      name: input.name,
      type: input.type,
      acknowledgeMode: input.acknowledgeMode,
      deadLetterQueue: input.deadLetterQueue,
      maxReceiveCount: input.maxReceiveCount,
      defaultVisibilityTimeout: input.defaultVisibilityTimeout,
      messageRetention: input.messageRetention,
      delaySeconds: input.delaySeconds,
      maxSize: input.maxSize,
      tags: input.tags ? new Map(Object.entries(input.tags)) : undefined,
    });
    return { success: true, data: { name: result.name } };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Delete a queue
 */
export async function DeleteQueue(input: {
  name: string;
  force?: boolean;
}): Promise<{ success: true; data: boolean } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.deleteQueue(input.name, input.force ?? false);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Create a topic
 */
export async function CreateTopic(input: {
  name: string;
  contentBasedDeduplication?: boolean;
  deduplicationWindow?: number;
  tags?: Record<string, string>;
}): Promise<{ success: true; data: { name: string } } | { success: false; error: string; code: string }> {
  try {
    const result = pubSubStore.createTopic({
      name: input.name,
      contentBasedDeduplication: input.contentBasedDeduplication,
      deduplicationWindow: input.deduplicationWindow,
      tags: input.tags ? new Map(Object.entries(input.tags)) : undefined,
    });
    return { success: true, data: { name: result.name } };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Delete a topic
 */
export async function DeleteTopic(input: {
  name: string;
  force?: boolean;
}): Promise<{ success: true; data: boolean } | { success: false; error: string; code: string }> {
  try {
    const result = pubSubStore.deleteTopic(input.name, input.force ?? false);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Unsubscribe from a topic
 */
export async function Unsubscribe(input: {
  subscriptionId: string;
}): Promise<{ success: true; data: boolean } | { success: false; error: string; code: string }> {
  try {
    const result = pubSubStore.unsubscribe(input.subscriptionId);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Peek messages without consuming
 */
export async function Peek(input: {
  queue: string;
  maxMessages?: number;
}): Promise<{ success: true; data: Message[] } | { success: false; error: string; code: string }> {
  try {
    const messages = queueStore.peek(input.queue, input.maxMessages ?? 10);
    return { success: true, data: messages };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Change message visibility timeout
 */
export async function ChangeMessageVisibility(input: {
  messageId: string;
  visibilityTimeout: number;
}): Promise<{ success: true; data: Message } | { success: false; error: string; code: string }> {
  try {
    const result = queueStore.changeVisibility(input.messageId, input.visibilityTimeout);
    return { success: true, data: result };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Get queue statistics
 */
export async function GetQueueStats(input: {
  name: string;
}): Promise<{ success: true; data: { messageCount: number; inFlightCount: number; oldestMessageAge?: number } } | { success: false; error: string; code: string }> {
  try {
    const stats = queueStore.getQueueStats(input.name);
    return { success: true, data: stats };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}

/**
 * Purge all messages from a queue
 */
export async function PurgeQueue(input: {
  name: string;
}): Promise<{ success: true; data: { deletedCount: number } } | { success: false; error: string; code: string }> {
  try {
    const count = queueStore.purgeQueue(input.name);
    return { success: true, data: { deletedCount: count } };
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      code,
    };
  }
}
