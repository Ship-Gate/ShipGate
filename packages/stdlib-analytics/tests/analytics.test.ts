/**
 * Analytics Standard Library Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Analytics,
  createAnalytics,
  StandardEvents,
} from '../implementations/typescript/index';
import type { AnalyticsProvider, QueuedEvent } from '../implementations/typescript/types';

// Mock provider
function createMockProvider(): AnalyticsProvider & { sentEvents: QueuedEvent[] } {
  return {
    name: 'mock',
    sentEvents: [],
    async send(events: QueuedEvent[]) {
      this.sentEvents.push(...events);
    },
  };
}

describe('Analytics', () => {
  let analytics: Analytics;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    analytics = createAnalytics(mockProvider, {
      flushAt: 1, // Flush immediately for tests
      debug: false,
    });
  });

  describe('track', () => {
    it('should track event with user_id', async () => {
      const result = await analytics.track({
        event: 'Button_Clicked',
        userId: 'user_123',
        properties: { button_id: 'signup' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBeDefined();
        expect(result.data.queued).toBe(true);
      }

      await analytics.flush();
      expect(mockProvider.sentEvents.length).toBe(1);
      expect(mockProvider.sentEvents[0].type).toBe('track');
    });

    it('should track event with anonymous_id', async () => {
      const result = await analytics.track({
        event: 'Page_Viewed',
        anonymousId: 'anon_123',
      });

      expect(result.ok).toBe(true);
    });

    it('should reject invalid event name', async () => {
      const result = await analytics.track({
        event: '123_Invalid',
        userId: 'user_123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_EVENT_NAME');
      }
    });

    it('should reject missing identifier', async () => {
      const result = await analytics.track({
        event: 'Some_Event',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_IDENTIFIER');
      }
    });

    it('should accept standard event names', async () => {
      const result = await analytics.track({
        event: StandardEvents.ORDER_COMPLETED,
        userId: 'user_123',
        properties: {
          order_id: 'order_456',
          revenue: 99.99,
        },
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('identify', () => {
    it('should identify user with traits', async () => {
      const result = await analytics.identify({
        userId: 'user_123',
        traits: {
          email: 'user@example.com',
          name: 'John Doe',
          plan: 'premium',
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBeDefined();
      }
    });

    it('should merge anonymous user', async () => {
      const result = await analytics.identify({
        userId: 'user_123',
        anonymousId: 'anon_456',
        traits: { email: 'user@example.com' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.merged).toBe(true);
      }
    });

    it('should reject empty user_id', async () => {
      const result = await analytics.identify({
        userId: '',
        traits: {},
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_USER_ID');
      }
    });
  });

  describe('page', () => {
    it('should track page view', async () => {
      const result = await analytics.page({
        userId: 'user_123',
        name: 'Product Page',
        context: {
          page: {
            path: '/products/widget',
            url: 'https://example.com/products/widget',
            title: 'Widget - Example',
          },
        },
      });

      expect(result.ok).toBe(true);
    });

    it('should require page context', async () => {
      const result = await analytics.page({
        userId: 'user_123',
        context: {} as any,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_PAGE_CONTEXT');
      }
    });
  });

  describe('group', () => {
    it('should associate user with group', async () => {
      const result = await analytics.group({
        userId: 'user_123',
        groupId: 'company_acme',
        traits: {
          name: 'Acme Corp',
          industry: 'Technology',
        },
      });

      expect(result.ok).toBe(true);
    });

    it('should reject empty group_id', async () => {
      const result = await analytics.group({
        userId: 'user_123',
        groupId: '',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_GROUP_ID');
      }
    });
  });

  describe('alias', () => {
    it('should alias two identities', async () => {
      const result = await analytics.alias({
        previousId: 'anon_123',
        userId: 'user_456',
      });

      expect(result.ok).toBe(true);
    });

    it('should reject empty previous_id', async () => {
      const result = await analytics.alias({
        previousId: '',
        userId: 'user_123',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PREVIOUS_ID');
      }
    });
  });

  describe('flush', () => {
    it('should flush queued events', async () => {
      await analytics.track({ event: 'Event_1', userId: 'user_1' });
      await analytics.track({ event: 'Event_2', userId: 'user_2' });
      await analytics.track({ event: 'Event_3', userId: 'user_3' });

      await analytics.flush();

      expect(mockProvider.sentEvents.length).toBe(3);
    });
  });

  describe('anonymousId', () => {
    it('should generate anonymous ID', () => {
      const id = analytics.getAnonymousId();
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should persist anonymous ID', () => {
      const id1 = analytics.getAnonymousId();
      const id2 = analytics.getAnonymousId();
      expect(id1).toBe(id2);
    });

    it('should reset anonymous ID', () => {
      const id1 = analytics.getAnonymousId();
      analytics.reset();
      const id2 = analytics.getAnonymousId();
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Event Name Validation', () => {
  it('should accept valid event names', () => {
    const validNames = [
      'Button_Clicked',
      'Order_Completed',
      'Page_Viewed',
      'SignUp',
      'a',
      'Event123',
      'MyEvent_With_Underscores',
    ];

    const pattern = /^[A-Za-z][A-Za-z0-9_]*$/;

    for (const name of validNames) {
      expect(pattern.test(name)).toBe(true);
    }
  });

  it('should reject invalid event names', () => {
    const invalidNames = [
      '123_Event',      // Starts with number
      '_Event',         // Starts with underscore
      'Event-Name',     // Contains hyphen
      'Event Name',     // Contains space
      '',               // Empty
    ];

    const pattern = /^[A-Za-z][A-Za-z0-9_]*$/;

    for (const name of invalidNames) {
      expect(pattern.test(name)).toBe(false);
    }
  });
});
