/**
 * Base queue adapter interface and abstract implementation
 */

import type { MessageEnvelope, QueueConfig, QueueStats } from '../types.js';
import type { QueueAdapter, ConsumeOptions, RejectOptions } from './types.js';
import { QueueError, QueueNotFoundError, MessageNotFoundError } from '../errors.js';

// ============================================================================
// ABSTRACT QUEUE ADAPTER
// ============================================================================

export abstract class AbstractQueueAdapter implements QueueAdapter {
  abstract readonly name: string;
  
  protected queues = new Map<string, QueueConfig>();
  protected closed = false;
  
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------
  
  abstract healthCheck(): Promise<boolean>;
  
  async close(): Promise<void> {
    this.closed = true;
    await this.doClose();
  }
  
  protected abstract doClose(): Promise<void>;
  
  protected ensureNotClosed(): void {
    if (this.closed) {
      throw new QueueError('ADAPTER_CLOSED', 'Queue adapter is closed');
    }
  }
  
  // -------------------------------------------------------------------------
  // QUEUE MANAGEMENT
  // -------------------------------------------------------------------------
  
  async createQueue(config: QueueConfig): Promise<void> {
    this.ensureNotClosed();
    
    if (this.queues.has(config.name)) {
      throw new QueueError('QUEUE_ALREADY_EXISTS', `Queue '${config.name}' already exists`);
    }
    
    await this.doCreateQueue(config);
    this.queues.set(config.name, config);
  }
  
  protected abstract doCreateQueue(config: QueueConfig): Promise<void>;
  
  async deleteQueue(name: string): Promise<void> {
    this.ensureNotClosed();
    
    if (!this.queues.has(name)) {
      throw new QueueNotFoundError(name);
    }
    
    await this.doDeleteQueue(name);
    this.queues.delete(name);
  }
  
  protected abstract doDeleteQueue(name: string): Promise<void>;
  
  async queueExists(name: string): Promise<boolean> {
    this.ensureNotClosed();
    return this.queues.has(name) && await this.doQueueExists(name);
  }
  
  protected abstract doQueueExists(name: string): Promise<boolean>;
  
  async getQueueStats(name: string): Promise<QueueStats> {
    this.ensureNotClosed();
    
    if (!this.queues.has(name)) {
      throw new QueueNotFoundError(name);
    }
    
    return this.doGetQueueStats(name);
  }
  
  protected abstract doGetQueueStats(name: string): Promise<QueueStats>;
  
  // -------------------------------------------------------------------------
  // MESSAGE OPERATIONS
  // -------------------------------------------------------------------------
  
  async enqueue(queueName: string, message: MessageEnvelope): Promise<void> {
    this.ensureNotClosed();
    this.ensureQueueExists(queueName);
    
    this.validateMessage(message);
    await this.doEnqueue(queueName, message);
  }
  
  protected abstract doEnqueue(queueName: string, message: MessageEnvelope): Promise<void>;
  
  async enqueueBatch(queueName: string, messages: MessageEnvelope[]): Promise<void> {
    this.ensureNotClosed();
    this.ensureQueueExists(queueName);
    
    for (const message of messages) {
      this.validateMessage(message);
    }
    
    await this.doEnqueueBatch(queueName, messages);
  }
  
  protected abstract doEnqueueBatch(queueName: string, messages: MessageEnvelope[]): Promise<void>;
  
  async consume(queueName: string, options: ConsumeOptions): Promise<MessageEnvelope[]> {
    this.ensureNotClosed();
    this.ensureQueueExists(queueName);
    
    this.validateConsumeOptions(options);
    return this.doConsume(queueName, options);
  }
  
  protected abstract doConsume(queueName: string, options: ConsumeOptions): Promise<MessageEnvelope[]>;
  
  async peek(queueName: string, maxMessages: number): Promise<MessageEnvelope[]> {
    this.ensureNotClosed();
    this.ensureQueueExists(queueName);
    
    if (maxMessages <= 0 || maxMessages > 100) {
      throw new QueueError('INVALID_PARAMETER', 'maxMessages must be between 1 and 100');
    }
    
    return this.doPeek(queueName, maxMessages);
  }
  
  protected abstract doPeek(queueName: string, maxMessages: number): Promise<MessageEnvelope[]>;
  
  async acknowledge(messageId: string): Promise<void> {
    this.ensureNotClosed();
    await this.doAcknowledge(messageId);
  }
  
  protected abstract doAcknowledge(messageId: string): Promise<void>;
  
  async acknowledgeBatch(messageIds: string[]): Promise<void> {
    this.ensureNotClosed();
    await this.doAcknowledgeBatch(messageIds);
  }
  
  protected abstract doAcknowledgeBatch(messageIds: string[]): Promise<void>;
  
  async reject(messageId: string, options?: RejectOptions): Promise<void> {
    this.ensureNotClosed();
    await this.doReject(messageId, options);
  }
  
  protected abstract doReject(messageId: string, options?: RejectOptions): Promise<void>;
  
  async deadLetter(messageId: string, reason: string): Promise<void> {
    this.ensureNotClosed();
    await this.doDeadLetter(messageId, reason);
  }
  
  protected abstract doDeadLetter(messageId: string, reason: string): Promise<void>;
  
  async changeVisibility(messageId: string, visibilityTimeout: number): Promise<void> {
    this.ensureNotClosed();
    
    if (visibilityTimeout < 0) {
      throw new QueueError('INVALID_PARAMETER', 'visibilityTimeout must be non-negative');
    }
    
    await this.doChangeVisibility(messageId, visibilityTimeout);
  }
  
  protected abstract doChangeVisibility(messageId: string, visibilityTimeout: number): Promise<void>;
  
  async purgeQueue(queueName: string): Promise<number> {
    this.ensureNotClosed();
    this.ensureQueueExists(queueName);
    
    return this.doPurgeQueue(queueName);
  }
  
  protected abstract doPurgeQueue(queueName: string): Promise<number>;
  
  // -------------------------------------------------------------------------
  // VALIDATION HELPERS
  // -------------------------------------------------------------------------
  
  protected ensureQueueExists(name: string): void {
    if (!this.queues.has(name)) {
      throw new QueueNotFoundError(name);
    }
  }
  
  protected validateMessage(message: MessageEnvelope): void {
    if (!message.id) {
      throw new QueueError('INVALID_MESSAGE', 'Message must have an ID');
    }
    
    if (!message.payload) {
      throw new QueueError('INVALID_MESSAGE', 'Message must have a payload');
    }
    
    if (!message.timestamp) {
      throw new QueueError('INVALID_MESSAGE', 'Message must have a timestamp');
    }
    
    if (message.deliveryCount < 0) {
      throw new QueueError('INVALID_MESSAGE', 'Message delivery count must be non-negative');
    }
    
    if (message.maxDeliveries <= 0) {
      throw new QueueError('INVALID_MESSAGE', 'Message max deliveries must be positive');
    }
  }
  
  protected validateConsumeOptions(options: ConsumeOptions): void {
    if (options.maxMessages <= 0 || options.maxMessages > 100) {
      throw new QueueError('INVALID_PARAMETER', 'maxMessages must be between 1 and 100');
    }
    
    if (options.visibilityTimeout < 0) {
      throw new QueueError('INVALID_PARAMETER', 'visibilityTimeout must be non-negative');
    }
    
    if (options.waitTime < 0 || options.waitTime > 20000) {
      throw new QueueError('INVALID_PARAMETER', 'waitTime must be between 0 and 20000ms');
    }
  }
  
  // -------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------
  
  protected getQueueConfig(name: string): QueueConfig {
    const config = this.queues.get(name);
    if (!config) {
      throw new QueueNotFoundError(name);
    }
    return config;
  }
  
  protected isMessageVisible(message: MessageEnvelope): boolean {
    if (!message.visibleAt) {
      return true;
    }
    return message.visibleAt <= Date.now();
  }
  
  protected isMessageExpired(message: MessageEnvelope): boolean {
    if (!message.expiresAt) {
      return false;
    }
    return message.expiresAt <= Date.now();
  }
  
  protected shouldDeadLetter(message: MessageEnvelope, maxReceiveCount: number): boolean {
    return message.deliveryCount >= maxReceiveCount;
  }
}
