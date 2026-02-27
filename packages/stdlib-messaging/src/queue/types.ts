/**
 * Queue adapter types and interfaces
 */

import type { MessageEnvelope, QueueConfig, QueueStats, QueueType, AcknowledgeMode } from '../types.js';

// ============================================================================
// QUEUE ADAPTER INTERFACE
// ============================================================================

export interface QueueAdapter {
  /** Adapter name */
  readonly name: string;
  
  /** Check if adapter is healthy */
  healthCheck(): Promise<boolean>;
  
  /** Close the adapter and cleanup resources */
  close(): Promise<void>;
  
  // Queue management
  createQueue(config: QueueConfig): Promise<void>;
  deleteQueue(name: string): Promise<void>;
  queueExists(name: string): Promise<boolean>;
  getQueueStats(name: string): Promise<QueueStats>;
  
  // Message operations
  enqueue(queueName: string, message: MessageEnvelope): Promise<void>;
  enqueueBatch(queueName: string, messages: MessageEnvelope[]): Promise<void>;
  
  consume(queueName: string, options: ConsumeOptions): Promise<MessageEnvelope[]>;
  peek(queueName: string, maxMessages: number): Promise<MessageEnvelope[]>;
  
  acknowledge(messageId: string): Promise<void>;
  acknowledgeBatch(messageIds: string[]): Promise<void>;
  reject(messageId: string, options?: RejectOptions): Promise<void>;
  deadLetter(messageId: string, reason: string): Promise<void>;
  
  changeVisibility(messageId: string, visibilityTimeout: number): Promise<void>;
  
  purgeQueue(queueName: string): Promise<number>;
}

export interface ConsumeOptions {
  /** Maximum number of messages to consume */
  maxMessages: number;
  
  /** Visibility timeout in milliseconds */
  visibilityTimeout: number;
  
  /** Wait time for long polling in milliseconds */
  waitTime: number;
}

export interface RejectOptions {
  /** Delay before message becomes visible again */
  delay?: number;
  
  /** Reason for rejection */
  reason?: string;
}

// ============================================================================
// QUEUE FACTORY
// ============================================================================

export interface QueueAdapterFactory {
  /** Create a new queue adapter */
  create(config: QueueAdapterConfig): Promise<QueueAdapter>;
  
  /** Supported adapter types */
  readonly supportedTypes: string[];
}

export interface QueueAdapterConfig {
  /** Adapter type */
  type: string;
  
  /** Connection string or configuration */
  connection: string | Record<string, any>;
  
  /** Additional options */
  options?: Record<string, any>;
}

// ============================================================================
// QUEUE REGISTRY
// ============================================================================

export class QueueRegistry {
  private factories = new Map<string, QueueAdapterFactory>();
  
  /**
   * Register a queue adapter factory
   */
  register(type: string, factory: QueueAdapterFactory): void {
    this.factories.set(type, factory);
  }
  
  /**
   * Create a queue adapter
   */
  async create(config: QueueAdapterConfig): Promise<QueueAdapter> {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`No factory registered for queue type: ${config.type}`);
    }
    
    return factory.create(config);
  }
  
  /**
   * Get supported adapter types
   */
  getSupportedTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}

// ============================================================================
// GLOBAL REGISTRY
// ============================================================================

export const queueRegistry = new QueueRegistry();
