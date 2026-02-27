/**
 * Pub/Sub Implementation
 * 
 * Topic-based publish/subscribe messaging with filtering support.
 */

import { randomUUID } from 'crypto';
import { 
  queueStore, 
  createMessage,
  type Message, 
  type TopicName, 
  type QueueName,
  type MessageId,
} from './queue.js';

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionId = string;
export type FilterExpression = string;

export interface Topic {
  name: TopicName;
  contentBasedDeduplication: boolean;
  deduplicationWindow: number;
  deliveryPolicy?: DeliveryPolicy;
  createdAt: Date;
  updatedAt: Date;
  tags: Map<string, string>;
}

export interface DeliveryPolicy {
  maxRetries: number;
  retryBackoff: BackoffPolicy;
  deadLetterTopic?: TopicName;
}

export interface BackoffPolicy {
  type: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
}

export interface Subscription {
  id: SubscriptionId;
  topic: TopicName;
  queue: QueueName;
  filter?: FilterExpression;
  rawMessageDelivery: boolean;
  enableBatching: boolean;
  batchSize: number;
  batchWindow: number;
  enabled: boolean;
  messagesReceived: number;
  messagesFiltered: number;
  messagesDelivered: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicStats {
  subscriptionCount: number;
  messagesPublished: number;
  messagesDelivered: number;
}

export interface PublishResult {
  messageId: MessageId;
  message: Message;
}

export interface BatchPublishResult {
  successful: Message[];
  failed: Array<{
    index: number;
    error: string;
  }>;
}

// ============================================================================
// ERRORS
// ============================================================================

export class PubSubError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'PubSubError';
  }
}

// ============================================================================
// PUB/SUB STORE
// ============================================================================

export class PubSubStore {
  private topics: Map<TopicName, Topic> = new Map();
  private subscriptions: Map<SubscriptionId, Subscription> = new Map();
  private topicSubscriptions: Map<TopicName, Set<SubscriptionId>> = new Map();
  private idempotencyCache: Map<string, { messageId: MessageId; expiresAt: Date }> = new Map();
  private stats: Map<TopicName, TopicStats> = new Map();

  // ==========================================================================
  // TOPIC OPERATIONS
  // ==========================================================================

  createTopic(config: {
    name: TopicName;
    contentBasedDeduplication?: boolean;
    deduplicationWindow?: number;
    deliveryPolicy?: DeliveryPolicy;
    tags?: Map<string, string>;
  }): Topic {
    if (this.topics.has(config.name)) {
      throw new PubSubError('TOPIC_ALREADY_EXISTS', `Topic ${config.name} already exists`);
    }

    const topic: Topic = {
      name: config.name,
      contentBasedDeduplication: config.contentBasedDeduplication ?? false,
      deduplicationWindow: config.deduplicationWindow ?? 5 * 60 * 1000,
      deliveryPolicy: config.deliveryPolicy,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: config.tags ?? new Map(),
    };

    this.topics.set(config.name, topic);
    this.topicSubscriptions.set(config.name, new Set());
    this.stats.set(config.name, {
      subscriptionCount: 0,
      messagesPublished: 0,
      messagesDelivered: 0,
    });

    return topic;
  }

  getTopic(name: TopicName): Topic | undefined {
    return this.topics.get(name);
  }

  deleteTopic(name: TopicName, force: boolean = false): boolean {
    const topic = this.topics.get(name);
    if (!topic) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${name} does not exist`);
    }

    const subs = this.topicSubscriptions.get(name);
    if (subs && subs.size > 0 && !force) {
      throw new PubSubError(
        'TOPIC_HAS_SUBSCRIPTIONS',
        `Topic ${name} has ${subs.size} subscriptions`
      );
    }

    // Remove subscriptions
    if (subs) {
      for (const subId of subs) {
        this.subscriptions.delete(subId);
      }
    }

    this.topics.delete(name);
    this.topicSubscriptions.delete(name);
    this.stats.delete(name);

    return true;
  }

  getTopicStats(name: TopicName): TopicStats {
    const stats = this.stats.get(name);
    if (!stats) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${name} does not exist`);
    }
    return { ...stats };
  }

  // ==========================================================================
  // SUBSCRIPTION OPERATIONS
  // ==========================================================================

  subscribe(config: {
    topic: TopicName;
    queue: QueueName;
    filter?: FilterExpression;
    rawMessageDelivery?: boolean;
    enableBatching?: boolean;
    batchSize?: number;
    batchWindow?: number;
  }): Subscription {
    if (!this.topics.has(config.topic)) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${config.topic} does not exist`);
    }

    if (!queueStore.getQueue(config.queue)) {
      throw new PubSubError('QUEUE_NOT_FOUND', `Queue ${config.queue} does not exist`);
    }

    // Check for duplicate subscription
    const existingSubs = this.topicSubscriptions.get(config.topic)!;
    for (const subId of existingSubs) {
      const sub = this.subscriptions.get(subId);
      if (sub && sub.queue === config.queue) {
        throw new PubSubError(
          'DUPLICATE_SUBSCRIPTION',
          `Queue ${config.queue} is already subscribed to topic ${config.topic}`
        );
      }
    }

    const subscription: Subscription = {
      id: randomUUID(),
      topic: config.topic,
      queue: config.queue,
      filter: config.filter,
      rawMessageDelivery: config.rawMessageDelivery ?? false,
      enableBatching: config.enableBatching ?? true,
      batchSize: config.batchSize ?? 10,
      batchWindow: config.batchWindow ?? 100,
      enabled: true,
      messagesReceived: 0,
      messagesFiltered: 0,
      messagesDelivered: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    existingSubs.add(subscription.id);

    // Update stats
    const stats = this.stats.get(config.topic)!;
    stats.subscriptionCount++;

    return subscription;
  }

  unsubscribe(subscriptionId: SubscriptionId): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new PubSubError('SUBSCRIPTION_NOT_FOUND', `Subscription ${subscriptionId} does not exist`);
    }

    this.subscriptions.delete(subscriptionId);
    this.topicSubscriptions.get(subscription.topic)?.delete(subscriptionId);

    // Update stats
    const stats = this.stats.get(subscription.topic);
    if (stats) {
      stats.subscriptionCount--;
    }

    return true;
  }

  getSubscription(subscriptionId: SubscriptionId): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  updateSubscription(
    subscriptionId: SubscriptionId,
    updates: Partial<Pick<Subscription, 
      'filter' | 'rawMessageDelivery' | 'enableBatching' | 'batchSize' | 'batchWindow' | 'enabled'
    >>
  ): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new PubSubError('SUBSCRIPTION_NOT_FOUND', `Subscription ${subscriptionId} does not exist`);
    }

    Object.assign(subscription, updates, { updatedAt: new Date() });
    return subscription;
  }

  listSubscriptions(topic: TopicName, limit: number = 100, cursor?: string): {
    subscriptions: Subscription[];
    nextCursor?: string;
  } {
    if (!this.topics.has(topic)) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${topic} does not exist`);
    }

    const subIds = Array.from(this.topicSubscriptions.get(topic) ?? []);
    const subscriptions: Subscription[] = [];

    let startIndex = 0;
    if (cursor) {
      const foundIndex = subIds.findIndex(id => id === cursor);
      startIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
    }

    for (let i = startIndex; i < subIds.length && subscriptions.length < limit; i++) {
      const subId = subIds[i];
      if (!subId) continue;
      const sub = this.subscriptions.get(subId);
      if (sub) {
        subscriptions.push(sub);
      }
    }

    const nextCursor = subscriptions.length === limit && startIndex + limit < subIds.length
      ? subIds[startIndex + limit - 1]
      : undefined;

    return { subscriptions, nextCursor };
  }

  // ==========================================================================
  // PUBLISH OPERATIONS
  // ==========================================================================

  publish(config: {
    topic: TopicName;
    payload: string;
    contentType?: string;
    headers?: Map<string, string>;
    partitionKey?: string;
    correlationId?: string;
    causationId?: string;
    idempotencyKey?: string;
    delay?: number;
    scheduledAt?: Date;
    expiresAt?: Date;
  }): PublishResult {
    const topic = this.topics.get(config.topic);
    if (!topic) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${config.topic} does not exist`);
    }

    // Check payload size
    if (config.payload.length > 262144) {
      throw new PubSubError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum size (256KB)');
    }

    // Check idempotency
    if (config.idempotencyKey) {
      const cached = this.idempotencyCache.get(`${config.topic}:${config.idempotencyKey}`);
      if (cached && cached.expiresAt > new Date()) {
        const existingMessage = queueStore.getMessage(cached.messageId);
        if (existingMessage) {
          return { messageId: cached.messageId, message: existingMessage };
        }
      }
    }

    // Create message
    const message = createMessage({
      topic: config.topic,
      payload: config.payload,
      contentType: config.contentType,
      headers: config.headers,
      correlationId: config.correlationId,
      causationId: config.causationId,
      idempotencyKey: config.idempotencyKey,
      scheduledAt: config.scheduledAt ?? (config.delay ? new Date(Date.now() + config.delay) : undefined),
      expiresAt: config.expiresAt,
    });

    // Cache idempotency key
    if (config.idempotencyKey) {
      this.idempotencyCache.set(`${config.topic}:${config.idempotencyKey}`, {
        messageId: message.id,
        expiresAt: new Date(Date.now() + topic.deduplicationWindow),
      });
    }

    // Fan out to subscribers
    const subIds = this.topicSubscriptions.get(config.topic) ?? new Set();
    for (const subId of subIds) {
      const subscription = this.subscriptions.get(subId);
      if (!subscription || !subscription.enabled) continue;

      subscription.messagesReceived++;

      // Apply filter
      if (subscription.filter && !this.matchFilter(message, subscription.filter)) {
        subscription.messagesFiltered++;
        continue;
      }

      // Enqueue to subscriber's queue
      try {
        queueStore.enqueue(subscription.queue, { ...message });
        subscription.messagesDelivered++;
      } catch (error) {
        // Log but don't fail the publish
        // In production, would handle this more gracefully
      }
    }

    // Update stats
    const stats = this.stats.get(config.topic)!;
    stats.messagesPublished++;
    stats.messagesDelivered += subIds.size;

    return { messageId: message.id, message };
  }

  publishBatch(config: {
    topic: TopicName;
    messages: Array<{
      payload: string;
      headers?: Map<string, string>;
      partitionKey?: string;
      idempotencyKey?: string;
    }>;
  }): BatchPublishResult {
    if (!this.topics.has(config.topic)) {
      throw new PubSubError('TOPIC_NOT_FOUND', `Topic ${config.topic} does not exist`);
    }

    if (config.messages.length > 100) {
      throw new PubSubError('BATCH_TOO_LARGE', 'Batch contains more than 100 messages');
    }

    const successful: Message[] = [];
    const failed: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < config.messages.length; i++) {
      const msgConfig = config.messages[i];
      if (!msgConfig) continue;
      try {
        const result = this.publish({
          topic: config.topic,
          payload: msgConfig.payload,
          headers: msgConfig.headers,
          partitionKey: msgConfig.partitionKey,
          idempotencyKey: msgConfig.idempotencyKey,
        });
        successful.push(result.message);
      } catch (error) {
        failed.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { successful, failed };
  }

  // ==========================================================================
  // FILTER MATCHING
  // ==========================================================================

  private matchFilter(message: Message, filter: FilterExpression): boolean {
    // Simple filter implementation
    // In production, would use a proper expression parser
    try {
      // Parse simple JSON-based filters
      const filterObj = JSON.parse(filter);
      
      for (const [key, value] of Object.entries(filterObj)) {
        const headerValue = message.headers.get(key);
        if (headerValue !== value) {
          return false;
        }
      }
      
      return true;
    } catch {
      // If filter parsing fails, allow message through
      return true;
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  cleanupIdempotencyCache(): void {
    const now = new Date();
    for (const [key, value] of this.idempotencyCache) {
      if (value.expiresAt <= now) {
        this.idempotencyCache.delete(key);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const pubSubStore = new PubSubStore();

// ============================================================================
// EXPORTED BEHAVIORS
// ============================================================================

export function publish(config: Parameters<PubSubStore['publish']>[0]): PublishResult {
  return pubSubStore.publish(config);
}

export function subscribe(config: Parameters<PubSubStore['subscribe']>[0]): Subscription {
  return pubSubStore.subscribe(config);
}

export function unsubscribe(subscriptionId: SubscriptionId): boolean {
  return pubSubStore.unsubscribe(subscriptionId);
}

export function createTopic(config: Parameters<PubSubStore['createTopic']>[0]): Topic {
  return pubSubStore.createTopic(config);
}

export function deleteTopic(name: TopicName, force?: boolean): boolean {
  return pubSubStore.deleteTopic(name, force);
}
