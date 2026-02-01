/**
 * Segment Analytics Provider
 * 
 * Sends events to Segment's HTTP tracking API.
 * https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/
 */

import type {
  AnalyticsProvider,
  ProviderConfig,
  QueuedEvent,
  TrackPayload,
  IdentifyPayload,
  PagePayload,
  GroupPayload,
  AliasPayload,
} from '../types';

const DEFAULT_API_URL = 'https://api.segment.io/v1';

export interface SegmentConfig extends ProviderConfig {
  /** Segment write key */
  writeKey: string;
}

export class SegmentProvider implements AnalyticsProvider {
  name = 'segment';
  private config: SegmentConfig;
  private apiUrl: string;

  constructor(config: SegmentConfig) {
    this.config = config;
    this.apiUrl = config.dataPlaneUrl || DEFAULT_API_URL;
  }

  async send(events: QueuedEvent[]): Promise<void> {
    // Batch events by type for efficiency
    const batch = events.map((event) => this.transformEvent(event));

    const response = await fetch(`${this.apiUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(this.config.writeKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({ batch }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Segment API error: ${response.status} ${error}`);
    }
  }

  private transformEvent(event: QueuedEvent): SegmentEvent {
    switch (event.type) {
      case 'track':
        return this.transformTrack(event.payload as TrackPayload, event.id);
      case 'identify':
        return this.transformIdentify(event.payload as IdentifyPayload, event.id);
      case 'page':
        return this.transformPage(event.payload as PagePayload, event.id);
      case 'group':
        return this.transformGroup(event.payload as GroupPayload, event.id);
      case 'alias':
        return this.transformAlias(event.payload as AliasPayload, event.id);
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private transformTrack(payload: TrackPayload, messageId: string): SegmentEvent {
    return {
      type: 'track',
      messageId,
      userId: payload.userId,
      anonymousId: payload.anonymousId,
      event: payload.event,
      properties: payload.properties,
      context: this.transformContext(payload.context),
      timestamp: payload.timestamp.toISOString(),
      integrations: payload.integrations,
    };
  }

  private transformIdentify(payload: IdentifyPayload, messageId: string): SegmentEvent {
    return {
      type: 'identify',
      messageId,
      userId: payload.userId,
      anonymousId: payload.anonymousId,
      traits: payload.traits,
      context: this.transformContext(payload.context),
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformPage(payload: PagePayload, messageId: string): SegmentEvent {
    return {
      type: 'page',
      messageId,
      userId: payload.userId,
      anonymousId: payload.anonymousId,
      name: payload.name,
      category: payload.category,
      properties: {
        ...payload.properties,
        ...payload.context.page,
      },
      context: this.transformContext(payload.context),
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformGroup(payload: GroupPayload, messageId: string): SegmentEvent {
    return {
      type: 'group',
      messageId,
      userId: payload.userId,
      groupId: payload.groupId,
      traits: payload.traits,
      context: this.transformContext(payload.context),
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformAlias(payload: AliasPayload, messageId: string): SegmentEvent {
    return {
      type: 'alias',
      messageId,
      userId: payload.userId,
      previousId: payload.previousId,
      context: this.transformContext(payload.context),
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformContext(context?: Record<string, unknown>): Record<string, unknown> {
    if (!context) return {};

    return {
      ...context,
      library: {
        name: '@isl-lang/stdlib-analytics',
        version: '1.0.0',
      },
    };
  }
}

interface SegmentEvent {
  type: string;
  messageId: string;
  userId?: string;
  anonymousId?: string;
  event?: string;
  properties?: Record<string, unknown>;
  traits?: Record<string, unknown>;
  name?: string;
  category?: string;
  groupId?: string;
  previousId?: string;
  context: Record<string, unknown>;
  timestamp: string;
  integrations?: Record<string, boolean>;
}

/**
 * Create Segment provider
 */
export function createSegmentProvider(config: SegmentConfig): SegmentProvider {
  return new SegmentProvider(config);
}
