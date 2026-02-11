/**
 * Request-Reply pattern implementation
 */

import { randomUUID } from 'crypto';
import type { 
  MessageEnvelope, 
  CorrelationStrategy, 
  HandlerResult,
  ConsumerConfig,
  ProducerConfig,
} from '../types.js';
import type { QueueAdapter } from '../queue/types.js';
import type { 
  RequestReplyPattern as IRequestReplyPattern,
  RequestHandler,
  PendingRequest,
  RequestOptions,
} from './types.js';
import { MessageConsumer, MessageProducer } from '../queue/index.js';
import { RequestTimeoutError, NoReplyQueueError } from '../errors.js';

// ============================================================================
// REQUEST-REPLY IMPLEMENTATION
// ============================================================================

export class RequestReplyPattern implements IRequestReplyPattern {
  private pendingRequests = new Map<string, PendingRequest>();
  private consumer?: MessageConsumer;
  private producer?: MessageProducer;
  private closed = false;
  
  constructor(
    private readonly adapter: QueueAdapter,
    private readonly config: {
      requestQueue: string;
      replyQueue: string;
      defaultTimeout?: number;
      correlationStrategy?: CorrelationStrategy;
    }
  ) {
    this.initialize();
  }
  
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------
  
  private async initialize(): Promise<void> {
    // Create producer for requests
    this.producer = new MessageProducer(this.adapter, {
      defaultQueue: this.config.requestQueue,
    });
    
    // Create consumer for replies
    const consumerConfig: ConsumerConfig = {
      queue: this.config.replyQueue,
      maxMessages: 10,
      visibilityTimeout: 30000,
      waitTime: 1000,
      handler: this.handleReply.bind(this),
      concurrency: 10,
    };
    
    this.consumer = new MessageConsumer(this.adapter, consumerConfig);
    await this.consumer.start();
  }
  
  async close(): Promise<void> {
    this.closed = true;
    
    if (this.consumer) {
      await this.consumer.stop();
    }
    
    if (this.producer) {
      await this.producer.close();
    }
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Request-reply pattern closed'));
    }
    this.pendingRequests.clear();
  }
  
  // -------------------------------------------------------------------------
  // REQUEST METHODS
  // -------------------------------------------------------------------------
  
  async request<TRequest, TResponse>(
    request: TRequest,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    if (this.closed) {
      throw new Error('Request-reply pattern is closed');
    }
    
    const timeout = options.timeout || this.config.defaultTimeout || 30000;
    const correlationId = this.generateCorrelationId(request, options);
    
    return new Promise<TResponse>((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new RequestTimeoutError(correlationId, timeout));
      }, timeout);
      
      // Store pending request
      this.pendingRequests.set(correlationId, {
        id: correlationId,
        resolve,
        reject,
        timer,
        timestamp: Date.now(),
      });
      
      // Send request
      this.producer!.produce(request, {
        correlationId,
        headers: {
          ...options.headers,
          'x-reply-to': this.config.replyQueue,
          'x-request-id': correlationId,
        },
        priority: options.priority,
      }).catch(error => {
        clearTimeout(timer);
        this.pendingRequests.delete(correlationId);
        reject(error);
      });
    });
  }
  
  async reply<TRequest, TResponse>(
    handler: RequestHandler<TRequest, TResponse>
  ): Promise<void> {
    const consumerConfig: ConsumerConfig = {
      queue: this.config.requestQueue,
      maxMessages: 10,
      visibilityTimeout: 30000,
      waitTime: 1000,
      handler: async (message: MessageEnvelope<TRequest>) => {
        try {
          // Extract reply information
          const replyTo = message.headers['x-reply-to'];
          const requestId = message.headers['x-request-id'] || message.correlationId;
          
          if (!replyTo || !requestId) {
            // No reply queue or request ID, ack and ignore
            return HandlerResult.ACK;
          }
          
          // Process request
          const response = await handler(message);
          
          // Send reply
          await this.producer!.produce(response, {
            correlationId: requestId,
            headers: {
              'x-reply-to-request': requestId,
              'x-original-message': message.id,
            },
          });
          
          return HandlerResult.ACK;
        } catch (error) {
          console.error('Error handling request:', error);
          return HandlerResult.NACK;
        }
      },
      concurrency: 10,
    };
    
    const requestConsumer = new MessageConsumer(this.adapter, consumerConfig);
    await requestConsumer.start();
  }
  
  // -------------------------------------------------------------------------
  // PRIVATE METHODS
  // -------------------------------------------------------------------------
  
  private async handleReply(message: MessageEnvelope): Promise<HandlerResult> {
    const requestId = message.headers['x-reply-to-request'] || message.correlationId;
    
    if (!requestId) {
      return HandlerResult.ACK; // Not a reply message
    }
    
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return HandlerResult.ACK; // No pending request, might be expired
    }
    
    // Clear timeout and remove from pending
    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
    
    // Resolve the promise
    pending.resolve(message.payload);
    
    return HandlerResult.ACK;
  }
  
  private generateCorrelationId(request: any, options: RequestOptions): string {
    const strategy = options.correlationStrategy || 
                    this.config.correlationStrategy || 
                    CorrelationStrategy.GENERATE;
    
    switch (strategy) {
      case CorrelationStrategy.GENERATE:
        return randomUUID();
        
      case CorrelationStrategy.MESSAGE_ID:
        return (request as any).id || randomUUID();
        
      case CorrelationStrategy.PRESERVE:
        return (request as any).correlationId || randomUUID();
        
      default:
        return randomUUID();
    }
  }
  
  // -------------------------------------------------------------------------
  // STATISTICS
  // -------------------------------------------------------------------------
  
  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
  
  /**
   * Get pending request details
   */
  getPendingRequests(): Array<{
    id: string;
    timestamp: number;
    age: number;
  }> {
    const now = Date.now();
    return Array.from(this.pendingRequests.values()).map(pending => ({
      id: pending.id,
      timestamp: pending.timestamp,
      age: now - pending.timestamp,
    }));
  }
  
  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return false;
    }
    
    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
    pending.reject(new Error('Request cancelled'));
    
    return true;
  }
}

// ============================================================================
// REQUEST-REPLY BUILDER
// ============================================================================

export class RequestReplyBuilder {
  private config: {
    requestQueue?: string;
    replyQueue?: string;
    defaultTimeout?: number;
    correlationStrategy?: CorrelationStrategy;
  } = {};
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  requestQueue(name: string): RequestReplyBuilder {
    this.config.requestQueue = name;
    return this;
  }
  
  replyQueue(name: string): RequestReplyBuilder {
    this.config.replyQueue = name;
    return this;
  }
  
  defaultTimeout(ms: number): RequestReplyBuilder {
    this.config.defaultTimeout = ms;
    return this;
  }
  
  correlationStrategy(strategy: CorrelationStrategy): RequestReplyBuilder {
    this.config.correlationStrategy = strategy;
    return this;
  }
  
  build(): RequestReplyPattern {
    if (!this.config.requestQueue) {
      throw new Error('Request queue is required');
    }
    
    if (!this.config.replyQueue) {
      throw new Error('Reply queue is required');
    }
    
    return new RequestReplyPattern(this.adapter, this.config as {
      requestQueue: string;
      replyQueue: string;
      defaultTimeout?: number;
      correlationStrategy?: CorrelationStrategy;
    });
  }
}

// ============================================================================
// REQUEST-REPLY FACTORY
// ============================================================================

export class RequestReplyFactory {
  /**
   * Create a simple request-reply pattern
   */
  static create(
    adapter: QueueAdapter,
    requestQueue: string,
    replyQueue: string
  ): RequestReplyPattern {
    return new RequestReplyBuilder(adapter)
      .requestQueue(requestQueue)
      .replyQueue(replyQueue)
      .build();
  }
  
  /**
   * Create a request-reply pattern with custom configuration
   */
  static createWithConfig(
    adapter: QueueAdapter,
    config: {
      requestQueue: string;
      replyQueue: string;
      defaultTimeout?: number;
      correlationStrategy?: CorrelationStrategy;
    }
  ): RequestReplyPattern {
    return new RequestReplyPattern(adapter, config);
  }
}
