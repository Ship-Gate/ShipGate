/**
 * Dead letter handler implementation
 */

import type { MessageEnvelope } from '../types.js';
import type { DeadLetterHandler, DeadLetterProcessor, DeadLetterAction } from './types.js';
import type { QueueAdapter } from '../queue/types.js';
import { BackoffCalculator } from './policy.js';
import { DeadLetterError } from '../errors.js';

// ============================================================================
// DEFAULT DEAD LETTER HANDLER
// ============================================================================

export class DefaultDeadLetterHandler implements DeadLetterHandler {
  readonly name = 'default';
  
  constructor(
    private readonly adapter: QueueAdapter,
    private readonly deadLetterQueue: string
  ) {}
  
  async handle(message: MessageEnvelope, reason: string, retries: number): Promise<void> {
    // Add dead letter metadata
    const deadLetterMessage: MessageEnvelope = {
      ...message,
      headers: {
        ...message.headers,
        'x-dead-letter-reason': reason,
        'x-dead-letter-retries': retries.toString(),
        'x-dead-letter-at': Date.now().toString(),
        'x-original-queue': message.headers['x-original-queue'] || 'unknown',
      },
      deadLetterReason: reason,
      originalQueue: message.headers['x-original-queue'] || 'unknown',
    };
    
    // Send to dead letter queue
    await this.adapter.enqueue(this.deadLetterQueue, deadLetterMessage);
  }
}

// ============================================================================
// LOGGING DEAD LETTER HANDLER
// ============================================================================

export class LoggingDeadLetterHandler implements DeadLetterHandler {
  readonly name = 'logging';
  
  constructor(
    private readonly logger: (message: string, data: any) => void = console.error
  ) {}
  
  async handle(message: MessageEnvelope, reason: string, retries: number): Promise<void> {
    this.logger('Message dead-lettered', {
      messageId: message.id,
      reason,
      retries,
      payload: message.payload,
      headers: message.headers,
    });
  }
}

// ============================================================================
// CALLBACK DEAD LETTER HANDLER
// ============================================================================

export class CallbackDeadLetterHandler implements DeadLetterHandler {
  readonly name: string;
  
  constructor(
    name: string,
    private readonly callback: (message: MessageEnvelope, reason: string, retries: number) => Promise<void>
  ) {
    this.name = name;
  }
  
  async handle(message: MessageEnvelope, reason: string, retries: number): Promise<void> {
    await this.callback(message, reason, retries);
  }
}

// ============================================================================
// COMPOSITE DEAD LETTER HANDLER
// ============================================================================

export class CompositeDeadLetterHandler implements DeadLetterHandler {
  readonly name = 'composite';
  
  constructor(private readonly handlers: DeadLetterHandler[]) {}
  
  async handle(message: MessageEnvelope, reason: string, retries: number): Promise<void> {
    const errors: Error[] = [];
    
    for (const handler of this.handlers) {
      try {
        await handler.handle(message, reason, retries);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    
    if (errors.length > 0 && errors.length === this.handlers.length) {
      throw new DeadLetterError(
        'ALL_HANDLERS_FAILED',
        `All ${errors.length} dead letter handlers failed: ${errors.map(e => e.message).join(', ')}`
      );
    }
  }
}

// ============================================================================
// DEAD LETTER PROCESSOR IMPLEMENTATION
// ============================================================================

export class DefaultDeadLetterProcessor implements DeadLetterProcessor {
  private running = false;
  private processing = new Set<string>();
  
  constructor(
    private readonly adapter: QueueAdapter,
    private readonly getPolicies: (queue: string) => Promise<DeadLetterPolicy | null>
  ) {}
  
  async processFailedMessage(
    message: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<DeadLetterAction> {
    const queue = message.headers['x-original-queue'] as string;
    if (!queue) {
      return DeadLetterAction.DEAD_LETTER;
    }
    
    const policy = await this.getPolicies(queue);
    if (!policy) {
      return DeadLetterAction.DEAD_LETTER;
    }
    
    // Check if should retry
    if (attempt <= policy.maxRetries) {
      // Calculate delay
      const delay = BackoffCalculator.calculateDelay(
        policy.backoffPolicy,
        attempt - 1
      );
      
      // Schedule retry
      setTimeout(async () => {
        await this.retryMessage(message, queue);
      }, delay);
      
      return DeadLetterAction.RETRY;
    }
    
    // Dead letter the message
    if (policy.handler) {
      await policy.handler.handle(message, error.message, attempt);
    } else {
      // Use default handler
      const defaultHandler = new DefaultDeadLetterHandler(
        this.adapter,
        policy.deadLetterQueue
      );
      await defaultHandler.handle(message, error.message, attempt);
    }
    
    return DeadLetterAction.DEAD_LETTER;
  }
  
  async start(): Promise<void> {
    this.running = true;
  }
  
  async stop(): Promise<void> {
    this.running = false;
    
    // Wait for all processing to complete
    while (this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  private async retryMessage(message: MessageEnvelope, queue: string): Promise<void> {
    if (!this.running) {
      return;
    }
    
    const processingKey = `${message.id}:${queue}`;
    
    if (this.processing.has(processingKey)) {
      return; // Already processing
    }
    
    this.processing.add(processingKey);
    
    try {
      // Reset message for retry
      const retryMessage: MessageEnvelope = {
        ...message,
        deliveryCount: message.deliveryCount + 1,
        visibleAt: Date.now(),
        headers: {
          ...message.headers,
          'x-retry-attempt': (message.deliveryCount + 1).toString(),
          'x-last-error': message.headers['x-last-error'] || '',
        },
      };
      
      // Re-enqueue message
      await this.adapter.enqueue(queue, retryMessage);
    } catch (error) {
      console.error('Failed to retry message:', error);
    } finally {
      this.processing.delete(processingKey);
    }
  }
}

// ============================================================================
// DEAD LETTER HANDLER BUILDER
// ============================================================================

export class DeadLetterHandlerBuilder {
  private handlers: DeadLetterHandler[] = [];
  
  static create(): DeadLetterHandlerBuilder {
    return new DeadLetterHandlerBuilder();
  }
  
  /**
   * Add default handler that sends to dead letter queue
   */
  toQueue(queueName: string, adapter: QueueAdapter): DeadLetterHandlerBuilder {
    this.handlers.push(new DefaultDeadLetterHandler(adapter, queueName));
    return this;
  }
  
  /**
   * Add logging handler
   */
  log(logger?: (message: string, data: any) => void): DeadLetterHandlerBuilder {
    this.handlers.push(new LoggingDeadLetterHandler(logger));
    return this;
  }
  
  /**
   * Add custom callback handler
   */
  callback(
    name: string,
    callback: (message: MessageEnvelope, reason: string, retries: number) => Promise<void>
  ): DeadLetterHandlerBuilder {
    this.handlers.push(new CallbackDeadLetterHandler(name, callback));
    return this;
  }
  
  /**
   * Add custom handler
   */
  custom(handler: DeadLetterHandler): DeadLetterHandlerBuilder {
    this.handlers.push(handler);
    return this;
  }
  
  /**
   * Build the composite handler
   */
  build(): DeadLetterHandler {
    if (this.handlers.length === 0) {
      throw new Error('At least one handler must be added');
    }
    
    if (this.handlers.length === 1) {
      return this.handlers[0];
    }
    
    return new CompositeDeadLetterHandler(this.handlers);
  }
}
