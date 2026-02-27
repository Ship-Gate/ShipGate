// ============================================================================
// Outbox Pattern
// ============================================================================

import { OutboxStatus } from './types.js';

/**
 * Outbox message
 */
export interface OutboxMessage<TPayload = unknown> {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  createdAt: Date;
  processedAt?: Date;
  status: OutboxStatus;
  retryCount: number;
  error?: string;
}

/**
 * Create an outbox message
 */
export function createOutboxMessage<TPayload = unknown>(
  params: Omit<OutboxMessage<TPayload>, 'id' | 'createdAt' | 'status' | 'retryCount'>
): OutboxMessage<TPayload> {
  return {
    id: globalThis.crypto.randomUUID(),
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    eventType: params.eventType,
    payload: params.payload,
    createdAt: new Date(),
    status: OutboxStatus.PENDING,
    retryCount: 0,
  };
}

/**
 * Outbox processor interface
 */
export interface IOutboxProcessor {
  /**
   * Add a message to the outbox
   */
  enqueue<TPayload>(message: OutboxMessage<TPayload>): Promise<void>;

  /**
   * Process pending messages
   */
  process(batchSize?: number): Promise<number>;

  /**
   * Get pending message count
   */
  getPendingCount(): Promise<number>;

  /**
   * Clean up processed messages
   */
  cleanup(olderThanMs?: number): Promise<number>;
}

/**
 * Message publisher function type
 */
export type MessagePublisher = (message: OutboxMessage) => Promise<void>;

/**
 * In-memory outbox processor implementation
 */
export class InMemoryOutboxProcessor implements IOutboxProcessor {
  private messages: OutboxMessage[] = [];
  private maxRetries = 3;

  constructor(private readonly publisher: MessagePublisher) {}

  async enqueue<TPayload>(message: OutboxMessage<TPayload>): Promise<void> {
    this.messages.push(message as OutboxMessage);
  }

  async process(batchSize = 100): Promise<number> {
    const pending = this.messages
      .filter((m) => m.status === OutboxStatus.PENDING || m.status === OutboxStatus.FAILED)
      .filter((m) => m.retryCount < this.maxRetries)
      .slice(0, batchSize);

    let processed = 0;

    for (const message of pending) {
      message.status = OutboxStatus.PROCESSING;

      try {
        await this.publisher(message);
        message.status = OutboxStatus.PROCESSED;
        message.processedAt = new Date();
        message.error = undefined;
        processed++;
      } catch (err) {
        message.retryCount++;
        message.error = err instanceof Error ? err.message : String(err);

        if (message.retryCount >= this.maxRetries) {
          message.status = OutboxStatus.DEAD_LETTERED;
        } else {
          message.status = OutboxStatus.FAILED;
        }
      }
    }

    return processed;
  }

  async getPendingCount(): Promise<number> {
    return this.messages.filter(
      (m) => m.status === OutboxStatus.PENDING || m.status === OutboxStatus.FAILED
    ).length;
  }

  async cleanup(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const originalLength = this.messages.length;

    this.messages = this.messages.filter(
      (m) => m.status !== OutboxStatus.PROCESSED || m.processedAt! > cutoff
    );

    return originalLength - this.messages.length;
  }

  /**
   * Get all messages (for testing)
   */
  getMessages(): OutboxMessage[] {
    return [...this.messages];
  }

  /**
   * Clear all messages (for testing)
   */
  clear(): void {
    this.messages = [];
  }
}

/**
 * Create an outbox processor
 */
export function createOutboxProcessor(publisher: MessagePublisher): InMemoryOutboxProcessor {
  return new InMemoryOutboxProcessor(publisher);
}

/**
 * Integration event interface for cross-service communication
 */
export interface IntegrationEvent<TPayload = unknown> extends OutboxMessage<TPayload> {
  destination?: string;
  partitionKey?: string;
}

/**
 * Create an integration event
 */
export function createIntegrationEvent<TPayload = unknown>(
  params: Omit<IntegrationEvent<TPayload>, 'id' | 'createdAt' | 'status' | 'retryCount'> & {
    destination?: string;
    partitionKey?: string;
  }
): IntegrationEvent<TPayload> {
  return {
    ...createOutboxMessage(params),
    destination: params.destination,
    partitionKey: params.partitionKey,
  };
}
