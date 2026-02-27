/**
 * Message consumer implementation
 */

import type { 
  MessageEnvelope, 
  ConsumerConfig, 
  HandlerResult, 
  ErrorHandlingResult,
  Middleware,
  ConsumeContext 
} from '../types.js';
import type { QueueAdapter } from './types.js';
import { 
  ConsumerError, 
  ConsumerStoppedError, 
  HandlerTimeoutError,
  ConcurrencyLimitExceededError,
  MessageNotFoundError,
  VisibilityExpiredError 
} from '../errors.js';

// ============================================================================
// MESSAGE CONSUMER
// ============================================================================

export class MessageConsumer {
  private running = false;
  private activeHandlers = new Set<Promise<void>>();
  private concurrencyController?: ConcurrencyController;
  
  constructor(
    private readonly adapter: QueueAdapter,
    private readonly config: ConsumerConfig
  ) {
    if (config.concurrency && config.concurrency > 1) {
      this.concurrencyController = new ConcurrencyController(config.concurrency);
    }
  }
  
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------
  
  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    
    this.running = true;
    
    // Start the consume loop
    this.consumeLoop().catch(error => {
      console.error('Consumer loop error:', error);
      this.running = false;
    });
  }
  
  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    this.running = false;
    
    // Wait for all active handlers to complete
    await Promise.all(Array.from(this.activeHandlers));
    this.activeHandlers.clear();
  }
  
  /**
   * Check if consumer is running
   */
  isRunning(): boolean {
    return this.running;
  }
  
  // -------------------------------------------------------------------------
  // CONSUME LOOP
  // -------------------------------------------------------------------------
  
  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        // Check concurrency limit
        if (this.concurrencyController) {
          await this.concurrencyController.waitForSlot();
        }
        
        // Consume messages
        const messages = await this.adapter.consume(this.config.queue, {
          maxMessages: this.config.maxMessages,
          visibilityTimeout: this.config.visibilityTimeout,
          waitTime: this.config.waitTime,
        });
        
        if (messages.length === 0) {
          continue;
        }
        
        // Process each message
        for (const message of messages) {
          if (!this.running) break;
          
          const handlerPromise = this.processMessage(message)
            .finally(() => {
              this.activeHandlers.delete(handlerPromise);
              this.concurrencyController?.releaseSlot();
            });
          
          this.activeHandlers.add(handlerPromise);
        }
      } catch (error) {
        if (error instanceof ConsumerStoppedError) {
          break;
        }
        
        // Handle consume errors
        if (this.config.errorHandler) {
          await this.config.errorHandler(
            error as Error, 
            { id: 'unknown', payload: null } as MessageEnvelope
          );
        }
        
        // Back off on error
        await this.backoff(1000);
      }
    }
  }
  
  // -------------------------------------------------------------------------
  // MESSAGE PROCESSING
  // -------------------------------------------------------------------------
  
  private async processMessage(message: MessageEnvelope): Promise<void> {
    const context: ConsumeContext = {
      message,
      queue: this.config.queue,
      config: this.config,
      metadata: {
        startTime: Date.now(),
        attempt: message.deliveryCount,
      },
    };
    
    try {
      // Apply middleware
      let result = HandlerResult.ACK;
      
      if (this.config.middleware) {
        result = await this.applyMiddleware(context);
      } else {
        result = await this.config.handler(message);
      }
      
      // Handle result
      switch (result) {
        case HandlerResult.ACK:
          await this.adapter.acknowledge(message.id);
          break;
          
        case HandlerResult.NACK:
          await this.adapter.reject(message.id);
          break;
          
        case HandlerResult.DEAD_LETTER:
          await this.adapter.deadLetter(message.id, 'Handler requested dead letter');
          break;
      }
    } catch (error) {
      // Handle processing errors
      await this.handleProcessingError(message, error as Error);
    }
  }
  
  private async applyMiddleware(context: ConsumeContext): Promise<HandlerResult> {
    const middleware = this.config.middleware || [];
    let index = 0;
    
    const next = async (): Promise<HandlerResult> => {
      if (index >= middleware.length) {
        // All middleware executed, call handler
        return this.config.handler(context.message);
      }
      
      const current = middleware[index++];
      if (current.consume) {
        return current.consume(context, next);
      } else {
        return next();
      }
    };
    
    return next();
  }
  
  private async handleProcessingError(message: MessageEnvelope, error: Error): Promise<void> {
    if (this.config.errorHandler) {
      const result = await this.config.errorHandler(error, message);
      
      switch (result) {
        case ErrorHandlingResult.RETRY:
          await this.adapter.reject(message.id, { delay: 5000 });
          break;
          
        case ErrorHandlingResult.DEAD_LETTER:
          await this.adapter.deadLetter(message.id, error.message);
          break;
          
        case ErrorHandlingResult.DISCARD:
          await this.adapter.acknowledge(message.id);
          break;
      }
    } else {
      // Default behavior: reject and retry
      await this.adapter.reject(message.id, { delay: 5000 });
    }
  }
  
  // -------------------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------------------
  
  private async backoff(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CONCURRENCY CONTROLLER
// ============================================================================

class ConcurrencyController {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  
  constructor(private readonly maxConcurrency: number) {}
  
  async waitForSlot(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }
  
  releaseSlot(): void {
    this.active--;
    
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      this.active++;
      next();
    }
  }
}

// ============================================================================
// CONSUMER BUILDER
// ============================================================================

export class ConsumerBuilder {
  private config: Partial<ConsumerConfig> = {
    maxMessages: 10,
    visibilityTimeout: 30000,
    waitTime: 0,
    autoStart: true,
    concurrency: 1,
  };
  
  constructor(private readonly adapter: QueueAdapter) {}
  
  queue(name: string): ConsumerBuilder {
    this.config.queue = name;
    return this;
  }
  
  maxMessages(count: number): ConsumerBuilder {
    this.config.maxMessages = count;
    return this;
  }
  
  visibilityTimeout(ms: number): ConsumerBuilder {
    this.config.visibilityTimeout = ms;
    return this;
  }
  
  waitTime(ms: number): ConsumerBuilder {
    this.config.waitTime = ms;
    return this;
  }
  
  handler<T>(handler: (message: MessageEnvelope<T>) => Promise<HandlerResult>): ConsumerBuilder {
    this.config.handler = handler as MessageHandler;
    return this;
  }
  
  errorHandler(handler: ErrorHandler): ConsumerBuilder {
    this.config.errorHandler = handler;
    return this;
  }
  
  middleware(...middleware: Middleware[]): ConsumerBuilder {
    this.config.middleware = middleware;
    return this;
  }
  
  autoStart(autoStart: boolean): ConsumerBuilder {
    this.config.autoStart = autoStart;
    return this;
  }
  
  concurrency(level: number): ConsumerBuilder {
    this.config.concurrency = level;
    return this;
  }
  
  build(): MessageConsumer {
    if (!this.config.queue) {
      throw new ConsumerError('MISSING_QUEUE', 'Queue name is required');
    }
    
    if (!this.config.handler) {
      throw new ConsumerError('MISSING_HANDLER', 'Message handler is required');
    }
    
    const consumer = new MessageConsumer(this.adapter, this.config as ConsumerConfig);
    
    if (this.config.autoStart) {
      consumer.start().catch(error => {
        console.error('Failed to start consumer:', error);
      });
    }
    
    return consumer;
  }
}
