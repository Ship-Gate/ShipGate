/**
 * Event Bus
 *
 * Publish and subscribe to domain events.
 */

import { StoredEvent } from './event-store.js';

export interface EventBusOptions {
  /** Enable async event handling */
  async?: boolean;
  /** Maximum concurrent handlers */
  maxConcurrency?: number;
  /** Retry failed handlers */
  retryOnFailure?: boolean;
  /** Maximum retries */
  maxRetries?: number;
}

export type EventHandler<T = unknown> = (event: StoredEvent<T>) => Promise<void> | void;

export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Event type */
  eventType: string;
  /** Unsubscribe function */
  unsubscribe: () => void;
}

export class EventBus {
  private options: Required<EventBusOptions>;
  private handlers: Map<string, Set<{ id: string; handler: EventHandler }>>;
  private subscriptionCounter: number;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      async: options.async ?? true,
      maxConcurrency: options.maxConcurrency ?? 10,
      retryOnFailure: options.retryOnFailure ?? true,
      maxRetries: options.maxRetries ?? 3,
    };

    this.handlers = new Map();
    this.subscriptionCounter = 0;
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    const id = `sub_${++this.subscriptionCounter}`;
    const handlerSet = this.handlers.get(eventType) ?? new Set();

    const handlerEntry = { id, handler: handler as EventHandler };
    handlerSet.add(handlerEntry);
    this.handlers.set(eventType, handlerSet);

    return {
      id,
      eventType,
      unsubscribe: () => {
        handlerSet.delete(handlerEntry);
      },
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): EventSubscription {
    return this.subscribe('*', handler);
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeMultiple<T>(
    eventTypes: string[],
    handler: EventHandler<T>
  ): EventSubscription[] {
    return eventTypes.map((type) => this.subscribe(type, handler));
  }

  /**
   * Publish an event
   */
  async publish<T>(event: StoredEvent<T>): Promise<void> {
    const typeHandlers = this.handlers.get(event.type) ?? new Set();
    const wildcardHandlers = this.handlers.get('*') ?? new Set();

    const allHandlers = [...typeHandlers, ...wildcardHandlers];

    if (this.options.async) {
      await this.publishAsync(event, allHandlers);
    } else {
      await this.publishSync(event, allHandlers);
    }
  }

  /**
   * Publish multiple events
   */
  async publishAll<T>(events: StoredEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Async event publishing with concurrency control
   */
  private async publishAsync<T>(
    event: StoredEvent<T>,
    handlers: Array<{ id: string; handler: EventHandler }>
  ): Promise<void> {
    const chunks = this.chunkArray(handlers, this.options.maxConcurrency);

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((h) => this.invokeHandler(event, h.handler))
      );
    }
  }

  /**
   * Sync event publishing
   */
  private async publishSync<T>(
    event: StoredEvent<T>,
    handlers: Array<{ id: string; handler: EventHandler }>
  ): Promise<void> {
    for (const { handler } of handlers) {
      await this.invokeHandler(event, handler);
    }
  }

  /**
   * Invoke a handler with retry logic
   */
  private async invokeHandler<T>(
    event: StoredEvent<T>,
    handler: EventHandler
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        await handler(event);
        return;
      } catch (error) {
        lastError = error as Error;

        if (!this.options.retryOnFailure || attempt === this.options.maxRetries - 1) {
          console.error(
            `Event handler failed for ${event.type}:`,
            lastError?.message
          );
          throw lastError;
        }

        // Wait before retry
        await this.sleep(Math.pow(2, attempt) * 100);
      }
    }
  }

  /**
   * Get subscriber count for an event type
   */
  getSubscriberCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all subscribed event types
   */
  getSubscribedTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Clear subscriptions for a specific event type
   */
  clearType(eventType: string): void {
    this.handlers.delete(eventType);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create an event bus instance
 */
export function createEventBus(options?: EventBusOptions): EventBus {
  return new EventBus(options);
}
