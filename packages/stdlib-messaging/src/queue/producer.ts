/**
 * Message producer implementation
 */

import { randomUUID } from 'crypto';
import type { 
  MessageEnvelope, 
  ProducerConfig, 
  MessageOptions,
  Middleware,
  ProduceContext 
} from '../types.js';
import type { QueueAdapter } from './types.js';
import { ProducerError, ProducerClosedError } from '../errors.js';

// ============================================================================
// MESSAGE PRODUCER
// ============================================================================

export class MessageProducer {
  private closed = false;
  private batchBuffer: MessageEnvelope[] = [];
  private batchTimer?: any;
  
  constructor(
    private readonly adapter: QueueAdapter,
    private readonly config: ProducerConfig
  ) {}
  
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------
  
  /**
   * Close the producer
   */
  async close(): Promise<void> {
    this.closed = true;
    
    // Flush any pending batch
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
  }
  
  /**
   * Check if producer is closed
   */
  isClosed(): boolean {
    return this.closed;
  }
  
  // -------------------------------------------------------------------------
  // PRODUCE METHODS
  // -------------------------------------------------------------------------
  
  /**
   * Produce a single message
   */
  async produce<T>(
    payload: T,
    options: MessageOptions & { queue?: string } = {}
  ): Promise<void> {
    this.ensureNotClosed();
    
    const queue = options.queue || this.config.defaultQueue;
    if (!queue) {
      throw new ProducerError('MISSING_QUEUE', 'No queue specified and no default queue configured');
    }
    
    const message = this.createMessage(payload, options);
    const context: ProduceContext = {
      message,
      queue,
      config: this.config,
      metadata: {
        produceTime: Date.now(),
      },
    };
    
    // Apply middleware
    if (this.config.middleware) {
      await this.applyProduceMiddleware(context);
    }
    
    // Send message
    await this.adapter.enqueue(queue, context.message);
  }
  
  /**
   * Produce multiple messages in a batch
   */
  async produceBatch<T>(
    messages: Array<{
      payload: T;
      options?: MessageOptions & { queue?: string };
    }>
  ): Promise<void> {
    this.ensureNotClosed();
    
    // Group by queue
    const messagesByQueue = new Map<string, MessageEnvelope[]>();
    
    for (const { payload, options = {} } of messages) {
      const queue = options.queue || this.config.defaultQueue;
      if (!queue) {
        throw new ProducerError('MISSING_QUEUE', 'No queue specified and no default queue configured');
      }
      
      const message = this.createMessage(payload, options);
      
      if (!messagesByQueue.has(queue)) {
        messagesByQueue.set(queue, []);
      }
      messagesByQueue.get(queue)!.push(message);
    }
    
    // Send batches to each queue
    for (const [queue, queueMessages] of messagesByQueue) {
      // Apply middleware to each message
      if (this.config.middleware) {
        for (const message of queueMessages) {
          const context: ProduceContext = {
            message,
            queue,
            config: this.config,
            metadata: {
              produceTime: Date.now(),
            },
          };
          
          await this.applyProduceMiddleware(context);
        }
      }
      
      await this.adapter.enqueueBatch(queue, queueMessages);
    }
  }
  
  /**
   * Add a message to the batch buffer
   */
  async addToBatch<T>(
    payload: T,
    options: MessageOptions & { queue?: string } = {}
  ): Promise<void> {
    this.ensureNotClosed();
    
    if (!this.config.batchSettings) {
      throw new ProducerError('BATCHING_NOT_CONFIGURED', 'Batch settings not configured');
    }
    
    const queue = options.queue || this.config.defaultQueue;
    if (!queue) {
      throw new ProducerError('MISSING_QUEUE', 'No queue specified and no default queue configured');
    }
    
    const message = this.createMessage(payload, options);
    this.batchBuffer.push(message);
    
    // Check if batch is full
    if (this.batchBuffer.length >= this.config.batchSettings.maxBatchSize) {
      await this.flushBatch();
    } else if (!this.batchTimer) {
      // Start batch timer
      this.batchTimer = setTimeout(
        () => this.flushBatch(),
        this.config.batchSettings.maxWaitTime
      );
    }
  }
  
  /**
   * Flush the current batch
   */
  async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) {
      return;
    }
    
    const messages = [...this.batchBuffer];
    this.batchBuffer = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    await this.produceBatch(
      messages.map(m => ({
        payload: m.payload,
        options: {
          queue: m.headers['x-queue'],
          correlationId: m.correlationId,
          causationId: m.causationId,
          partitionKey: m.partitionKey,
          priority: m.priority,
          delay: m.scheduledAt ? m.scheduledAt - Date.now() : undefined,
          expiresAt: m.expiresAt ? new Date(m.expiresAt) : undefined,
          maxDeliveries: m.maxDeliveries,
          visibilityTimeout: m.visibilityTimeout,
        },
      }))
    );
  }
  
  // -------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------
  
  private createMessage<T>(payload: T, options: MessageOptions): MessageEnvelope<T> {
    const now = Date.now();
    
    // Merge with default options
    const mergedOptions = { ...this.config.defaultOptions, ...options };
    
    return {
      id: randomUUID(),
      payload,
      headers: {
        'content-type': 'application/json',
        ...mergedOptions,
      },
      contentType: 'application/json',
      schemaId: mergedOptions.schemaId,
      schemaVersion: mergedOptions.schemaVersion,
      correlationId: mergedOptions.correlationId,
      causationId: mergedOptions.causationId,
      partitionKey: mergedOptions.partitionKey,
      priority: mergedOptions.priority,
      timestamp: now,
      scheduledAt: mergedOptions.scheduledAt?.getTime() || 
                   (mergedOptions.delay ? now + mergedOptions.delay : undefined),
      expiresAt: mergedOptions.expiresAt?.getTime(),
      deliveryCount: 0,
      maxDeliveries: mergedOptions.maxDeliveries || 10,
      visibilityTimeout: mergedOptions.visibilityTimeout,
    };
  }
  
  private async applyProduceMiddleware(context: ProduceContext): Promise<void> {
    const middleware = this.config.middleware || [];
    let index = 0;
    
    const next = async (): Promise<void> => {
      if (index >= middleware.length) {
        return;
      }
      
      const current = middleware[index++];
      if (current.produce) {
        return current.produce(context, next);
      } else {
        return next();
      }
    };
    
    await next();
  }
  
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new ProducerClosedError();
    }
  }
}

// ============================================================================
// PRODUCER BUILDER
// ============================================================================

export class ProducerBuilder {
  private config: Partial<ProducerConfig> = {};
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  defaultQueue(name: string): ProducerBuilder {
    this.config.defaultQueue = name;
    return this;
  }
  
  defaultOptions(options: Partial<MessageOptions>): ProducerBuilder {
    this.config.defaultOptions = { ...this.config.defaultOptions, ...options };
    return this;
  }
  
  middleware(...middleware: Middleware[]): ProducerBuilder {
    this.config.middleware = middleware;
    return this;
  }
  
  enableIdempotency(enable: boolean = true): ProducerBuilder {
    this.config.enableIdempotency = enable;
    return this;
  }
  
  batchSettings(settings: {
    maxBatchSize: number;
    maxWaitTime: number;
  }): ProducerBuilder {
    this.config.batchSettings = settings;
    return this;
  }
  
  build(): MessageProducer {
    return new MessageProducer(this.adapter, this.config as ProducerConfig);
  }
}
