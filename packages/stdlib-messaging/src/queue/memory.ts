/**
 * In-memory queue implementation
 */

import { randomUUID } from 'crypto';
import type { MessageEnvelope, QueueConfig, QueueStats, QueueType } from '../types.js';
import type { ConsumeOptions, RejectOptions } from './types.js';
import { AbstractQueueAdapter } from './adapter.js';
import { 
  QueueNotFoundError, 
  MessageNotFoundError, 
  MessageNotDeliveredError,
  VisibilityExpiredError 
} from '../errors.js';

// ============================================================================
// IN-MEMORY QUEUE ADAPTER
// ============================================================================

export class MemoryQueueAdapter extends AbstractQueueAdapter {
  readonly name = 'memory';
  
  private messages = new Map<string, MessageEnvelope[]>();
  private messageIndex = new Map<string, { message: MessageEnvelope; queue: string }>();
  private inFlight = new Map<string, Set<string>>();
  private consumers = new Map<string, Set<() => void>>();
  
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------
  
  async healthCheck(): Promise<boolean> {
    return !this.closed;
  }
  
  protected async doClose(): Promise<void> {
    // Clear all data
    this.messages.clear();
    this.messageIndex.clear();
    this.inFlight.clear();
    this.consumers.clear();
  }
  
  // -------------------------------------------------------------------------
  // QUEUE MANAGEMENT
  // -------------------------------------------------------------------------
  
  protected async doCreateQueue(config: QueueConfig): Promise<void> {
    this.messages.set(config.name, []);
    this.inFlight.set(config.name, new Set());
  }
  
  protected async doDeleteQueue(name: string): Promise<void> {
    // Remove all messages from index
    const messages = this.messages.get(name) || [];
    for (const message of messages) {
      this.messageIndex.delete(message.id);
    }
    
    this.messages.delete(name);
    this.inFlight.delete(name);
    this.consumers.delete(name);
  }
  
  protected async doQueueExists(name: string): Promise<boolean> {
    return this.messages.has(name);
  }
  
  protected async doGetQueueStats(name: string): Promise<QueueStats> {
    const messages = this.messages.get(name) || [];
    const inFlightSet = this.inFlight.get(name) || new Set();
    
    const visibleMessages = messages.filter(m => 
      this.isMessageVisible(m) && !inFlightSet.has(m.id)
    );
    
    const deadLetterCount = messages.filter(m => 
      m.deadLetterReason !== undefined
    ).length;
    
    let oldestMessageAge: number | undefined;
    if (visibleMessages.length > 0) {
      const oldest = visibleMessages.reduce((a, b) => 
        a.timestamp < b.timestamp ? a : b
      );
      oldestMessageAge = Date.now() - oldest.timestamp;
    }
    
    const config = this.getQueueConfig(name);
    
    return {
      messageCount: messages.filter(m => !m.deadLetterReason).length,
      inFlightCount: inFlightSet.size,
      oldestMessageAge,
      approximateDelay: config.delaySeconds,
      deadLetterCount,
    };
  }
  
  // -------------------------------------------------------------------------
  // MESSAGE OPERATIONS
  // -------------------------------------------------------------------------
  
  protected async doEnqueue(queueName: string, message: MessageEnvelope): Promise<void> {
    const messages = this.messages.get(queueName)!;
    const config = this.getQueueConfig(queueName);
    
    // Check queue size limit
    if (config.maxSize && messages.length >= config.maxSize) {
      throw new QueueError('QUEUE_FULL', `Queue '${queueName}' is at capacity`);
    }
    
    // Check message size
    const messageSize = JSON.stringify(message.payload).length;
    if (messageSize > config.maxMessageSize) {
      throw new QueueError('PAYLOAD_TOO_LARGE', 
        `Message size ${messageSize} exceeds maximum ${config.maxMessageSize}`);
    }
    
    // Clone message to avoid mutations
    const queuedMessage = { ...message };
    
    // Apply delay if configured
    if (config.delaySeconds > 0 && !queuedMessage.visibleAt) {
      queuedMessage.visibleAt = Date.now() + config.delaySeconds * 1000;
    }
    
    messages.push(queuedMessage);
    this.messageIndex.set(message.id, { message: queuedMessage, queue: queueName });
    
    // Sort based on queue type
    this.sortMessages(queueName, messages, config.type);
    
    // Notify waiting consumers
    this.notifyConsumers(queueName);
  }
  
  protected async doEnqueueBatch(queueName: string, messages: MessageEnvelope[]): Promise<void> {
    for (const message of messages) {
      await this.doEnqueue(queueName, message);
    }
  }
  
  protected async doConsume(queueName: string, options: ConsumeOptions): Promise<MessageEnvelope[]> {
    const messages = this.messages.get(queueName)!;
    const inFlightSet = this.inFlight.get(queueName)!;
    const config = this.getQueueConfig(queueName);
    const result: MessageEnvelope[] = [];
    const now = Date.now();
    
    // Wait for messages if configured
    if (options.waitTime > 0 && result.length === 0) {
      await this.waitForMessages(queueName, options.waitTime);
    }
    
    for (let i = 0; i < messages.length && result.length < options.maxMessages; i++) {
      const message = messages[i];
      
      // Skip if already in flight
      if (inFlightSet.has(message.id)) continue;
      
      // Skip if not visible yet
      if (!this.isMessageVisible(message)) continue;
      
      // Skip if expired
      if (this.isMessageExpired(message)) continue;
      
      // Check if should dead-letter
      if (this.shouldDeadLetter(message, config.maxReceiveCount)) {
        await this.doDeadLetter(message.id, 'Max receive count exceeded');
        continue;
      }
      
      // Deliver message
      message.deliveryCount++;
      message.visibleAt = now + options.visibilityTimeout;
      
      inFlightSet.add(message.id);
      result.push({ ...message });
    }
    
    return result;
  }
  
  protected async doPeek(queueName: string, maxMessages: number): Promise<MessageEnvelope[]> {
    const messages = this.messages.get(queueName)!;
    const result: MessageEnvelope[] = [];
    
    for (const message of messages) {
      if (result.length >= maxMessages) break;
      
      if (this.isMessageVisible(message) && !this.isMessageExpired(message)) {
        result.push({ ...message });
      }
    }
    
    return result;
  }
  
  protected async doAcknowledge(messageId: string): Promise<void> {
    const indexed = this.messageIndex.get(messageId);
    if (!indexed) {
      throw new MessageNotFoundError(messageId);
    }
    
    const { message, queue } = indexed;
    
    if (message.visibleAt === undefined) {
      throw new MessageNotDeliveredError(messageId);
    }
    
    // Check if visibility has expired
    if (message.visibleAt <= Date.now()) {
      throw new VisibilityExpiredError(messageId);
    }
    
    // Remove from queue
    await this.removeFromQueue(messageId, queue);
  }
  
  protected async doAcknowledgeBatch(messageIds: string[]): Promise<void> {
    for (const messageId of messageIds) {
      await this.doAcknowledge(messageId);
    }
  }
  
  protected async doReject(messageId: string, options?: RejectOptions): Promise<void> {
    const indexed = this.messageIndex.get(messageId);
    if (!indexed) {
      throw new MessageNotFoundError(messageId);
    }
    
    const { message, queue } = indexed;
    const config = this.getQueueConfig(queue);
    
    // Check if should dead-letter
    if (this.shouldDeadLetter(message, config.maxReceiveCount)) {
      await this.doDeadLetter(messageId, 'Max receive count exceeded');
      return;
    }
    
    // Reset message for retry
    message.visibleAt = Date.now() + (options?.delay || 0);
    this.inFlight.get(queue)?.delete(messageId);
    
    // Re-sort if priority queue
    this.sortMessages(queue, this.messages.get(queue)!, config.type);
  }
  
  protected async doDeadLetter(messageId: string, reason: string): Promise<void> {
    const indexed = this.messageIndex.get(messageId);
    if (!indexed) {
      throw new MessageNotFoundError(messageId);
    }
    
    const { message, queue } = indexed;
    const config = this.getQueueConfig(queue);
    
    // Mark as dead-lettered
    message.deadLetterReason = reason;
    message.originalQueue = queue;
    
    // Remove from in-flight
    this.inFlight.get(queue)?.delete(messageId);
    
    // Move to dead letter queue if configured
    if (config.deadLetterQueue) {
      if (!this.messages.has(config.deadLetterQueue)) {
        // Create DLQ if it doesn't exist
        await this.createQueue({
          ...config,
          name: config.deadLetterQueue,
          deadLetterQueue: undefined,
        });
      }
      
      await this.removeFromQueue(messageId, queue);
      this.messages.get(config.deadLetterQueue)!.push(message);
      this.messageIndex.set(messageId, { message, queue: config.deadLetterQueue });
    }
  }
  
  protected async doChangeVisibility(messageId: string, visibilityTimeout: number): Promise<void> {
    const indexed = this.messageIndex.get(messageId);
    if (!indexed) {
      throw new MessageNotFoundError(messageId);
    }
    
    const { message } = indexed;
    
    if (message.visibleAt === undefined) {
      throw new MessageNotDeliveredError(messageId);
    }
    
    message.visibleAt = visibilityTimeout === 0 
      ? Date.now() 
      : Date.now() + visibilityTimeout;
  }
  
  protected async doPurgeQueue(queueName: string): Promise<number> {
    const messages = this.messages.get(queueName) || [];
    const count = messages.length;
    
    // Remove all from index
    for (const message of messages) {
      this.messageIndex.delete(message.id);
    }
    
    // Clear queue
    this.messages.set(queueName, []);
    this.inFlight.get(queueName)?.clear();
    
    return count;
  }
  
  // -------------------------------------------------------------------------
  // UTILITY METHODS
  // -------------------------------------------------------------------------
  
  private sortMessages(queueName: string, messages: MessageEnvelope[], type: QueueType): void {
    switch (type) {
      case 'PRIORITY':
        messages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        break;
      
      case 'FIFO':
        messages.sort((a, b) => a.timestamp - b.timestamp);
        break;
      
      case 'DELAY':
        messages.sort((a, b) => (a.visibleAt || a.timestamp) - (b.visibleAt || b.timestamp));
        break;
    }
  }
  
  private async removeFromQueue(messageId: string, queueName: string): Promise<void> {
    const messages = this.messages.get(queueName)!;
    const index = messages.findIndex(m => m.id === messageId);
    
    if (index >= 0) {
      messages.splice(index, 1);
    }
    
    this.messageIndex.delete(messageId);
    this.inFlight.get(queueName)?.delete(messageId);
  }
  
  private async waitForMessages(queueName: string, timeout: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        const consumers = this.consumers.get(queueName);
        if (consumers) {
          consumers.delete(resolve);
        }
        resolve();
      }, timeout);
      
      const consumers = this.consumers.get(queueName);
      if (!consumers) {
        this.consumers.set(queueName, new Set([() => {
          clearTimeout(timer);
          resolve();
        }]));
      } else {
        consumers.add(() => {
          clearTimeout(timer);
          resolve();
        });
      }
    });
  }
  
  private notifyConsumers(queueName: string): void {
    const consumers = this.consumers.get(queueName);
    if (consumers) {
      for (const consumer of consumers) {
        consumer();
      }
      consumers.clear();
    }
  }
  
  // -------------------------------------------------------------------------
  // VISIBILITY TIMEOUT PROCESSOR
  // -------------------------------------------------------------------------
  
  /**
   * Process expired visibility timeouts and return messages to queue
   */
  processVisibilityTimeouts(): void {
    const now = Date.now();
    
    for (const [queueName, inFlightSet] of this.inFlight) {
      for (const messageId of inFlightSet) {
        const indexed = this.messageIndex.get(messageId);
        if (indexed && indexed.message.visibleAt && indexed.message.visibleAt <= now) {
          // Return to queue
          indexed.message.visibleAt = now;
          inFlightSet.delete(messageId);
          
          // Re-sort if priority queue
          const config = this.queues.get(queueName);
          if (config && config.type === 'PRIORITY') {
            this.sortMessages(queueName, this.messages.get(queueName)!, config.type);
          }
        }
      }
    }
  }
  
  /**
   * Start the visibility timeout processor
   */
  startVisibilityTimeoutProcessor(intervalMs: number = 1000): void {
    setInterval(() => {
      this.processVisibilityTimeouts();
    }, intervalMs);
  }
}
