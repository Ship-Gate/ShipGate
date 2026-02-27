/**
 * ISL Analytics Standard Library
 * 
 * Universal analytics API with multiple provider adapters.
 */

import { v4 as uuid } from 'uuid';
import type {
  AnalyticsConfig,
  AnalyticsProvider,
  TrackInput,
  TrackResult,
  IdentifyInput,
  IdentifyResult,
  PageInput,
  PageResult,
  GroupInput,
  GroupResult,
  AliasInput,
  AliasResult,
  Context,
  EventQueue,
  QueuedEvent,
} from './types';

export * from './types';

/**
 * Main Analytics client
 */
export class Analytics {
  private provider: AnalyticsProvider;
  private config: AnalyticsConfig;
  private queue: EventQueue;
  private flushTimer: NodeJS.Timeout | null = null;
  private anonymousId: string | null = null;

  constructor(provider: AnalyticsProvider, config: Partial<AnalyticsConfig> = {}) {
    this.provider = provider;
    this.config = {
      flushInterval: 10000,
      flushAt: 20,
      maxQueueSize: 1000,
      retryCount: 3,
      debug: false,
      ...config,
    };
    this.queue = {
      events: [],
      size: 0,
    };

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Track an analytics event
   */
  async track(input: TrackInput): Promise<TrackResult> {
    // Validate preconditions
    if (!input.userId && !input.anonymousId) {
      return {
        ok: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'Neither user_id nor anonymous_id provided',
        },
      };
    }

    if (!this.isValidEventName(input.event)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_EVENT_NAME',
          message: 'Event name does not match pattern ^[A-Za-z][A-Za-z0-9_]*$',
        },
      };
    }

    const id = uuid();
    const event: QueuedEvent = {
      id,
      type: 'track',
      payload: {
        event: input.event,
        userId: input.userId,
        anonymousId: input.anonymousId || this.getAnonymousId(),
        properties: input.properties,
        context: this.enrichContext(input.context),
        timestamp: input.timestamp || new Date(),
        integrations: input.integrations,
      },
      timestamp: new Date(),
      retries: 0,
    };

    const queued = this.enqueue(event);

    if (!queued) {
      return {
        ok: false,
        error: {
          code: 'QUEUE_FULL',
          message: 'Event queue is at capacity',
          retriable: true,
        },
      };
    }

    if (this.config.debug) {
      console.log('[Analytics] Track:', input.event, input.properties);
    }

    return {
      ok: true,
      data: {
        id,
        queued: true,
      },
    };
  }

  /**
   * Identify a user
   */
  async identify(input: IdentifyInput): Promise<IdentifyResult> {
    if (!input.userId || input.userId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'User ID is empty or invalid',
        },
      };
    }

    const id = uuid();
    const event: QueuedEvent = {
      id,
      type: 'identify',
      payload: {
        userId: input.userId,
        anonymousId: input.anonymousId || this.getAnonymousId(),
        traits: input.traits,
        context: this.enrichContext(input.context),
        timestamp: input.timestamp || new Date(),
      },
      timestamp: new Date(),
      retries: 0,
    };

    this.enqueue(event);

    // Update anonymous ID tracking
    if (input.anonymousId) {
      // Mark as merged
    }

    if (this.config.debug) {
      console.log('[Analytics] Identify:', input.userId, input.traits);
    }

    return {
      ok: true,
      data: {
        id,
        merged: !!input.anonymousId,
      },
    };
  }

  /**
   * Track a page view
   */
  async page(input: PageInput): Promise<PageResult> {
    if (!input.userId && !input.anonymousId) {
      return {
        ok: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'Neither user_id nor anonymous_id provided',
        },
      };
    }

    if (!input.context?.page) {
      return {
        ok: false,
        error: {
          code: 'MISSING_PAGE_CONTEXT',
          message: 'context.page is required for page views',
        },
      };
    }

    const id = uuid();
    const event: QueuedEvent = {
      id,
      type: 'page',
      payload: {
        userId: input.userId,
        anonymousId: input.anonymousId || this.getAnonymousId(),
        name: input.name,
        category: input.category,
        properties: input.properties,
        context: this.enrichContext(input.context),
        timestamp: new Date(),
      },
      timestamp: new Date(),
      retries: 0,
    };

    this.enqueue(event);

    if (this.config.debug) {
      console.log('[Analytics] Page:', input.context.page.path);
    }

    return {
      ok: true,
      data: { id },
    };
  }

  /**
   * Associate user with a group
   */
  async group(input: GroupInput): Promise<GroupResult> {
    if (!input.userId || input.userId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'User ID is empty or invalid',
        },
      };
    }

    if (!input.groupId || input.groupId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_GROUP_ID',
          message: 'Group ID is empty or invalid',
        },
      };
    }

    const id = uuid();
    const event: QueuedEvent = {
      id,
      type: 'group',
      payload: {
        userId: input.userId,
        groupId: input.groupId,
        traits: input.traits,
        context: this.enrichContext(input.context),
        timestamp: new Date(),
      },
      timestamp: new Date(),
      retries: 0,
    };

    this.enqueue(event);

    if (this.config.debug) {
      console.log('[Analytics] Group:', input.userId, '->', input.groupId);
    }

    return {
      ok: true,
      data: { id },
    };
  }

  /**
   * Alias two identities
   */
  async alias(input: AliasInput): Promise<AliasResult> {
    if (!input.previousId || input.previousId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PREVIOUS_ID',
          message: 'Previous ID is empty',
        },
      };
    }

    if (!input.userId || input.userId.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'User ID is empty',
        },
      };
    }

    const id = uuid();
    const event: QueuedEvent = {
      id,
      type: 'alias',
      payload: {
        previousId: input.previousId,
        userId: input.userId,
        context: this.enrichContext(input.context),
        timestamp: new Date(),
      },
      timestamp: new Date(),
      retries: 0,
    };

    this.enqueue(event);

    if (this.config.debug) {
      console.log('[Analytics] Alias:', input.previousId, '->', input.userId);
    }

    return {
      ok: true,
      data: { id },
    };
  }

  /**
   * Flush queued events to provider
   */
  async flush(): Promise<void> {
    if (this.queue.events.length === 0) {
      return;
    }

    const events = [...this.queue.events];
    this.queue.events = [];
    this.queue.size = 0;

    try {
      await this.provider.send(events);
      
      if (this.config.debug) {
        console.log(`[Analytics] Flushed ${events.length} events`);
      }
    } catch (error) {
      // Re-queue events that haven't exceeded retry limit
      const retryable = events
        .map((e) => ({ ...e, retries: e.retries + 1 }))
        .filter((e) => e.retries < this.config.retryCount);

      this.queue.events.push(...retryable);
      this.queue.size = this.queue.events.length;

      if (this.config.debug) {
        console.error('[Analytics] Flush failed, requeued', retryable.length, 'events');
      }
    }
  }

  /**
   * Shutdown and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Get or generate anonymous ID
   */
  getAnonymousId(): string {
    if (!this.anonymousId) {
      this.anonymousId = uuid();
    }
    return this.anonymousId;
  }

  /**
   * Set anonymous ID
   */
  setAnonymousId(id: string): void {
    this.anonymousId = id;
  }

  /**
   * Reset anonymous ID
   */
  reset(): void {
    this.anonymousId = null;
  }

  // Private methods

  private isValidEventName(name: string): boolean {
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && name.length <= 128;
  }

  private enqueue(event: QueuedEvent): boolean {
    if (this.queue.size >= this.config.maxQueueSize) {
      return false;
    }

    this.queue.events.push(event);
    this.queue.size++;

    // Flush if at threshold
    if (this.queue.size >= this.config.flushAt) {
      this.flush();
    }

    return true;
  }

  private enrichContext(context?: Context): Context {
    return {
      ...context,
      library: {
        name: '@isl-lang/stdlib-analytics',
        version: '1.0.0',
      },
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
}

/**
 * Create analytics client with provider
 */
export function createAnalytics(
  provider: AnalyticsProvider,
  config?: Partial<AnalyticsConfig>
): Analytics {
  return new Analytics(provider, config);
}

// Re-export providers
export { SegmentProvider } from './providers/segment';
export { AmplitudeProvider } from './providers/amplitude';
export { MixpanelProvider } from './providers/mixpanel';
export { PostHogProvider } from './providers/posthog';
