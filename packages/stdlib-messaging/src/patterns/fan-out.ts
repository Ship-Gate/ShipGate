/**
 * Fan-out pattern implementation
 */

import type { MessageEnvelope } from '../types.js';
import type { QueueAdapter } from '../queue/types.js';
import type { 
  FanOutPattern as IFanOutPattern,
  FanOutConfig,
  FanOutQueue,
  FanOutFilter,
  FanOutTransform,
  FanOutResult,
  FanOutQueueResult,
} from './types.js';
import { MessageProducer } from '../queue/index.js';
import { FanOutError } from '../errors.js';

// ============================================================================
// FAN-OUT IMPLEMENTATION
// ============================================================================

export class FanOutPattern implements IFanOutPattern {
  private queues = new Map<string, FanOutQueue>();
  private producer: MessageProducer;
  
  constructor(private readonly adapter: QueueAdapter) {
    this.producer = new MessageProducer(adapter);
  }
  
  // -------------------------------------------------------------------------
  // FAN-OUT METHODS
  // -------------------------------------------------------------------------
  
  async fanOut<T>(message: T, config: FanOutConfig): Promise<FanOutResult> {
    const results = new Map<string, FanOutQueueResult>();
    let successCount = 0;
    let failureCount = 0;
    
    // Determine target queues
    const targetQueues = await this.resolveTargetQueues(config);
    
    if (targetQueues.length === 0) {
      throw new FanOutError('No target queues found for fan-out');
    }
    
    // Create message envelope
    const envelope: MessageEnvelope<T> = {
      id: message.id || this.generateId(),
      payload: message,
      headers: {},
      contentType: 'application/json',
      timestamp: Date.now(),
      deliveryCount: 0,
      maxDeliveries: 10,
    };
    
    // Process each queue
    const promises = targetQueues.map(async (queue) => {
      try {
        // Apply filter
        if (queue.filter && !queue.filter(envelope)) {
          results.set(queue.name, {
            success: true,
            timestamp: Date.now(),
          });
          return;
        }
        
        // Apply transform
        let finalMessage = envelope;
        if (queue.transform) {
          finalMessage = queue.transform(envelope, queue.name);
        }
        
        // Send message
        await this.producer.produce(finalMessage.payload, {
          queue: queue.name,
          correlationId: finalMessage.correlationId,
          headers: finalMessage.headers,
          priority: finalMessage.priority,
        });
        
        results.set(queue.name, {
          success: true,
          timestamp: Date.now(),
        });
        successCount++;
      } catch (error) {
        results.set(queue.name, {
          success: false,
          error: error as Error,
          timestamp: Date.now(),
        });
        failureCount++;
        
        if (config.failFast) {
          throw new FanOutError(
            `Fan-out failed for queue ${queue.name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });
    
    // Wait for all deliveries
    if (config.parallel) {
      await Promise.all(promises);
    } else {
      for (const promise of promises) {
        await promise;
      }
    }
    
    return {
      results,
      success: failureCount === 0,
      successCount,
      failureCount,
    };
  }
  
  // -------------------------------------------------------------------------
  // QUEUE MANAGEMENT
  // -------------------------------------------------------------------------
  
  addQueue(queueName: string, filter?: FanOutFilter): void {
    this.queues.set(queueName, {
      name: queueName,
      filter,
    });
  }
  
  removeQueue(queueName: string): void {
    this.queues.delete(queueName);
  }
  
  listQueues(): string[] {
    return Array.from(this.queues.keys());
  }
  
  /**
   * Get queue configuration
   */
  getQueue(queueName: string): FanOutQueue | undefined {
    return this.queues.get(queueName);
  }
  
  /**
   * Update queue configuration
   */
  updateQueue(queueName: string, config: Partial<FanOutQueue>): void {
    const existing = this.queues.get(queueName);
    if (existing) {
      this.queues.set(queueName, { ...existing, ...config });
    }
  }
  
  /**
   * Clear all queues
   */
  clearQueues(): void {
    this.queues.clear();
  }
  
  // -------------------------------------------------------------------------
  // PRIVATE METHODS
  // -------------------------------------------------------------------------
  
  private async resolveTargetQueues(config: FanOutConfig): Promise<FanOutQueue[]> {
    if (typeof config.queues === 'string') {
      // Pattern matching
      const pattern = new RegExp(config.queues);
      const matchedQueues = Array.from(this.queues.keys()).filter(name => 
        pattern.test(name)
      );
      
      return matchedQueues.map(name => this.queues.get(name)!);
    } else if (Array.isArray(config.queues)) {
      // Specific queue names
      return config.queues.map(name => {
        const queue = this.queues.get(name);
        if (!queue) {
          throw new FanOutError(`Queue '${name}' not found in fan-out configuration`);
        }
        return queue;
      });
    } else {
      // Array of FanOutQueue objects
      return config.queues;
    }
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  // -------------------------------------------------------------------------
  // CLOSE
  // -------------------------------------------------------------------------
  
  async close(): Promise<void> {
    await this.producer.close();
  }
}

// ============================================================================
// FAN-OUT BUILDER
// ============================================================================

export class FanOutBuilder {
  private queues: FanOutQueue[] = [];
  private config: Partial<FanOutConfig> = {
    parallel: true,
    failFast: false,
  };
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  /**
   * Add a queue to the fan-out
   */
  to(queueName: string, filter?: FanOutFilter): FanOutBuilder {
    this.queues.push({
      name: queueName,
      filter,
    });
    return this;
  }
  
  /**
   * Add multiple queues
   */
  toMultiple(queues: Array<{ name: string; filter?: FanOutFilter }>): FanOutBuilder {
    this.queues.push(...queues);
    return this;
  }
  
  /**
   * Use queue pattern matching
   */
  toPattern(pattern: string): FanOutBuilder {
    this.config.queues = pattern;
    return this;
  }
  
  /**
   * Set global filter
   */
  filter(filter: FanOutFilter): FanOutBuilder {
    this.config.filter = filter;
    return this;
  }
  
  /**
   * Set global transform
   */
  transform(transform: FanOutTransform): FanOutBuilder {
    this.config.transform = transform;
    return this;
  }
  
  /**
   * Enable/disable parallel processing
   */
  parallel(parallel: boolean = true): FanOutBuilder {
    this.config.parallel = parallel;
    return this;
  }
  
  /**
   * Enable/disable fail fast
   */
  failFast(failFast: boolean = true): FanOutBuilder {
    this.config.failFast = failFast;
    return this;
  }
  
  /**
   * Build the fan-out pattern
   */
  build(): FanOutPattern {
    const pattern = new FanOutPattern(this.adapter);
    
    // Add queues if not using pattern
    if (!this.config.queues) {
      for (const queue of this.queues) {
        pattern.addQueue(queue.name, queue.filter);
      }
    }
    
    return pattern;
  }
}

// ============================================================================
// USEFUL FILTERS
// ============================================================================

export const FanOutFilters = {
  /**
   * Filter by header value
   */
  byHeader(key: string, value: string): FanOutFilter {
    return (message) => message.headers[key] === value;
  },
  
  /**
   * Filter by content type
   */
  byContentType(contentType: string): FanOutFilter {
    return (message) => message.contentType === contentType;
  },
  
  /**
   * Filter by priority
   */
  byPriority(minPriority: number): FanOutFilter {
    return (message) => (message.priority || 0) >= minPriority;
  },
  
  /**
   * Filter by payload property
   */
  byPayloadProperty(property: string, value: any): FanOutFilter {
    return (message) => {
      const payload = message.payload as any;
      return payload && payload[property] === value;
    };
  },
  
  /**
   * Combine multiple filters with AND logic
   */
  and(...filters: FanOutFilter[]): FanOutFilter {
    return (message) => filters.every(filter => filter(message));
  },
  
  /**
   * Combine multiple filters with OR logic
   */
  or(...filters: FanOutFilter[]): FanOutFilter {
    return (message) => filters.some(filter => filter(message));
  },
  
  /**
   * Negate a filter
   */
  not(filter: FanOutFilter): FanOutFilter {
    return (message) => !filter(message);
  },
};

// ============================================================================
// USEFUL TRANSFORMS
// ============================================================================

export const FanOutTransforms = {
  /**
   * Add headers
   */
  addHeaders(headers: Record<string, string>): FanOutTransform {
    return (message, queue) => ({
      ...message,
      headers: {
        ...message.headers,
        ...headers,
        'x-fan-out-queue': queue,
      },
    });
  },
  
  /**
   * Set priority based on queue
   */
  setPriorityByQueue(priorities: Record<string, number>): FanOutTransform {
    return (message, queue) => ({
      ...message,
      priority: priorities[queue] || message.priority,
    });
  },
  
  /**
   * Transform payload
   */
  transformPayload<T>(transformer: (payload: T, queue: string) => any): FanOutTransform {
    return (message, queue) => ({
      ...message,
      payload: transformer(message.payload as T, queue),
    });
  },
  
  /**
   * Clone message with new ID
   */
  cloneWithNewId(): FanOutTransform {
    return (message) => ({
      ...message,
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    });
  },
};
